/* eslint-disable @typescript-eslint/no-var-requires */
// A child has one sport, and every way of writing it leaves the legacy list agreeing.
//
// Before this rule the edit form wrote only `sportsFocus`, the assessment only
// `chosenSport`, and a child could be "Badminton" on the dashboard and "Tennis" in the
// form (2026-11-10). These tests pin the rule on each write path, and the one that used to
// bypass it.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { addDependent, updateDependent } = require("../shared/services/AuthService/dependents");
const { recordFindSportChoice } = require("../client/controllers/planCheckInController");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { primarySport, sportsFocusFor } = require("@powermysport/shared-types");
const { PARENTAL_CONSENT_VERSION } = require("../shared/services/AuthService/shared");
const redis = require("../config/redis").default;

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await Player.collection.deleteMany({});
  await User.collection.deleteMany({});
});

const seedParent = async () => {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id,
    name: "Parent Person",
    email: `parent-${_id}@test.com`,
    phone: `9${String(Date.now()).slice(-9)}`,
    role: "Parent",
    isActive: true,
    legalConsents: {
      parentalConsent: {
        accepted: true,
        acceptedAt: new Date(),
        version: PARENTAL_CONSENT_VERSION,
      },
    },
  });
  return _id.toString();
};

const stored = (id: unknown) => Player.findById(id).lean();

describe("primarySport", () => {
  it("is the committed sport, else the first of an old list, else nothing", () => {
    assert.equal(primarySport({ chosenSport: "Badminton", sportsFocus: ["Tennis"] }), "Badminton");
    assert.equal(primarySport({ sportsFocus: ["Tennis", "Squash"] }), "Tennis");
    assert.equal(primarySport({ chosenSport: "  ", sportsFocus: [] }), null);
    assert.equal(primarySport({}), null);
  });

  it("builds the legacy mirror from the sport alone", () => {
    assert.deepEqual(sportsFocusFor("Tennis"), ["Tennis"]);
    assert.deepEqual(sportsFocusFor(" "), []);
    assert.deepEqual(sportsFocusFor(undefined), []);
  });
});

describe("creating a child", () => {
  it("mirrors the sport into the list, dropping any other sports sent with it", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, {
      name: "Aarav",
      age: 10,
      chosenSport: "Badminton",
      sportsFocus: ["Tennis", "Squash"],
    });
    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Badminton");
    assert.deepEqual(row.sportsFocus, ["Badminton"]);
  });

  it("takes the first entry of an old-style list as the sport when none is chosen", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, sportsFocus: ["Tennis"] });
    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Tennis");
    assert.deepEqual(row.sportsFocus, ["Tennis"]);
  });
});

describe("updating a child", () => {
  it("changes the sport and the mirror together, and dates the new decision", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, chosenSport: "Tennis" });
    const before = new Date("2026-01-01T00:00:00.000Z");
    await Player.updateOne({ _id: child._id }, { chosenSportAt: before });

    await updateDependent(parent, child._id.toString(), { chosenSport: "Badminton" });

    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Badminton");
    assert.deepEqual(row.sportsFocus, ["Badminton"]);
    assert.ok(row.chosenSportAt > before, "a different sport is a new decision, dated now");
  });

  it("keeps the date when the same sport is saved again", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, chosenSport: "Tennis" });
    const at = new Date("2026-01-01T00:00:00.000Z");
    await Player.updateOne({ _id: child._id }, { chosenSportAt: at });

    await updateDependent(parent, child._id.toString(), { chosenSport: "Tennis", name: "Aarav S" });

    assert.equal((await stored(child._id)).chosenSportAt.toISOString(), at.toISOString());
  });

  it("ignores an old-style list for a child who already has a sport", async () => {
    // The assessment sends the sports a child used to play in that list. It must not turn a
    // committed sport into a past one.
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, chosenSport: "Badminton" });

    await updateDependent(parent, child._id.toString(), { sportsFocus: ["Tennis"] });

    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Badminton");
    assert.deepEqual(row.sportsFocus, ["Badminton"]);
  });

  it("clears the sport, and the mirror, when it is emptied", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, chosenSport: "Tennis" });

    await updateDependent(parent, child._id.toString(), { chosenSport: "" });

    const row = await stored(child._id);
    assert.equal(primarySport(row), null);
    assert.deepEqual(row.sportsFocus, []);
    assert.equal(row.chosenSportAt, undefined);
  });

  it("repairs a row from before the rule the next time it is saved", async () => {
    // Jatin's shape: committed to Badminton, list still says Tennis.
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Jatin", age: 14, chosenSport: "Badminton" });
    await Player.collection.updateOne({ _id: child._id }, { $set: { sportsFocus: ["Tennis"] } });

    await updateDependent(parent, child._id.toString(), { name: "Jatin S" });

    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Badminton");
    assert.deepEqual(row.sportsFocus, ["Badminton"]);
  });
});

describe("choosing a sport on the assessment results page", () => {
  const choose = async (userId: string, body: Record<string, unknown>) => {
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    };
    await new Promise<void>((resolve, reject) => {
      recordFindSportChoice({ user: { id: userId }, body } as any, res, (err: unknown) =>
        err ? reject(err) : resolve()
      );
      // asyncHandler resolves through res.json; give it a tick to finish.
      setTimeout(resolve, 150);
    });
  };

  it("replaces an earlier sport in the list instead of adding to it", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Aarav", age: 10, chosenSport: "Tennis" });

    await choose(parent, { dependentId: child._id.toString(), sport: "Badminton" });

    const row = await stored(child._id);
    assert.equal(row.chosenSport, "Badminton");
    assert.deepEqual(row.sportsFocus, ["Badminton"], "the list mirrors the sport, nothing else");
  });
});
