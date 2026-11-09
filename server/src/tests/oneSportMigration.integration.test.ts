/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 73: every stored child ends with one sport and a list that mirrors it.
// Runs against an in-memory database, never the real one.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { plan, planOne, up, down } = require("../migrations/73_one_sport_per_child");

let mongod: any;
const players = () => mongoose.connection.collection("players");
const backupPath = () => path.join(os.tmpdir(), `one-sport-${Date.now()}-${Math.random()}.json`);
const id = () => new mongoose.Types.ObjectId();
const quiet = async <T>(run: () => Promise<T>): Promise<T> => {
  const log = console.log;
  console.log = () => {};
  try {
    return await run();
  } finally {
    console.log = log;
  }
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await players().deleteMany({});
});

describe("planning one row", () => {
  it("leaves a row that already has the shape, and a row with no sport", () => {
    assert.equal(planOne({ _id: id(), chosenSport: "Tennis", sportsFocus: ["Tennis"] }), null);
    assert.equal(planOne({ _id: id(), sportsFocus: [] }), null);
    assert.equal(planOne({ _id: id() }), null);
  });

  it("keeps the chosen sport and drops what else was listed (the Jatin case)", () => {
    const change = planOne({ _id: id(), chosenSport: "Badminton", sportsFocus: ["Tennis"] });
    assert.equal(change.sport, "Badminton");
    assert.deepEqual(change.dropped, ["Tennis"]);
    assert.equal(change.backfilled, false);
  });

  it("takes the first listed sport when none was chosen, and drops the rest", () => {
    const change = planOne({ _id: id(), sportsFocus: ["Squash", "Tennis"] });
    assert.equal(change.sport, "Squash");
    assert.equal(change.backfilled, true);
    assert.deepEqual(change.dropped, ["Tennis"]);
  });

  it("does not count the chosen sport listed in another case as lost", () => {
    const change = planOne({ _id: id(), chosenSport: "Tennis", sportsFocus: ["tennis", "Tennis"] });
    assert.deepEqual(change.dropped, []);
  });

  it("plans only the rows that need it", () => {
    const rows = [
      { _id: id(), chosenSport: "Tennis", sportsFocus: ["Tennis"] },
      { _id: id(), sportsFocus: ["Squash"] },
    ];
    assert.equal(plan(rows).length, 1);
  });
});

describe("running it", () => {
  const seed = async () => {
    const jatin = id();
    const listOnly = id();
    const fine = id();
    await players().insertMany([
      { _id: jatin, name: "Jatin", chosenSport: "Badminton", sportsFocus: ["Tennis"] },
      { _id: listOnly, name: "Riya", sportsFocus: ["Squash", "Tennis"] },
      { _id: fine, name: "Ishaan", chosenSport: "Tennis", sportsFocus: ["Tennis"] },
    ]);
    return { jatin, listOnly, fine };
  };

  it("writes nothing on a dry run", async () => {
    const { jatin } = await seed();
    await quiet(() => up({}));
    assert.deepEqual((await players().findOne({ _id: jatin })).sportsFocus, ["Tennis"]);
  });

  it("refuses to apply without a backup file", async () => {
    await seed();
    await assert.rejects(() => quiet(() => up({ apply: true })), /--backup/);
  });

  it("applies, backs up the before-state, and is idempotent", async () => {
    const { jatin, listOnly, fine } = await seed();
    const file = backupPath();
    await quiet(() => up({ apply: true, backup: file }));

    const a = await players().findOne({ _id: jatin });
    assert.equal(a.chosenSport, "Badminton");
    assert.deepEqual(a.sportsFocus, ["Badminton"]);
    const b = await players().findOne({ _id: listOnly });
    assert.equal(b.chosenSport, "Squash");
    assert.deepEqual(b.sportsFocus, ["Squash"]);
    assert.equal(b.chosenSportAt, undefined, "a sport taken from the list stays undated");
    assert.deepEqual((await players().findOne({ _id: fine })).sportsFocus, ["Tennis"]);

    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.length, 2);
    assert.ok(!JSON.stringify(saved).includes("Jatin"), "names are never written to the backup");

    // A second run finds nothing, so it needs no new backup and writes no file.
    const second = backupPath();
    await quiet(() => up({ apply: true, backup: second }));
    assert.equal(fs.existsSync(second), false);
  });

  it("puts every row back from the backup with --down", async () => {
    const { jatin, listOnly } = await seed();
    const file = backupPath();
    await quiet(() => up({ apply: true, backup: file }));
    await quiet(() => down({ backup: file }));

    const a = await players().findOne({ _id: jatin });
    assert.equal(a.chosenSport, "Badminton");
    assert.deepEqual(a.sportsFocus, ["Tennis"]);
    const b = await players().findOne({ _id: listOnly });
    assert.equal(b.chosenSport, undefined, "a sport that was never set is unset again");
    assert.deepEqual(b.sportsFocus, ["Squash", "Tennis"]);
  });
});
