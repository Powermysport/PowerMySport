/* eslint-disable @typescript-eslint/no-var-requires */
// The search box's dropdown: GET /api/rankings/suggest. In-memory MongoDB only.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

const WEEK = new Date(Date.UTC(2026, 9, 5));

const PLAYERS: Array<[string, string, number, string, boolean]> = [
  ["200001", "Vikram Rao", 1, "Delhi", true],
  ["200002", "Aarav Vikranth", 2, "Goa", true],
  ["200003", "Vikas Mehta", 3, "Delhi", true],
  ["200004", "Meera Singh", 4, "Delhi", true],
  ["200005", "Vikrant Old", 1, "Delhi", false], // an archived week: never offered
];

const suggest = (q: string, extra = "") =>
  request(app).get(
    `/api/rankings/suggest?category=Boys&subcategory=U-12&q=${encodeURIComponent(q)}${extra}`
  );

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const snapshot = await RankingSnapshot.create({
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory: "U-12",
    asOnDate: WEEK,
    pdfUrl: "https://example.test/list",
    sourceUrl: "https://example.test",
    contentHash: "suggest-hash",
    status: "published",
    version: 1,
    isLatestForCombo: true,
    rowCount: PLAYERS.length,
  });
  await RankingEntry.insertMany(
    PLAYERS.map(([regNo, fullName, rank, state, isLatest]) => ({
      snapshot: snapshot._id,
      sportSlug: "tennis",
      federationCode: "AITA",
      category: "Boys",
      subcategory: "U-12",
      asOnDate: WEEK,
      isLatest,
      rank,
      regNo,
      givenName: fullName.split(" ")[0],
      familyName: fullName.split(" ")[1],
      fullName,
      nameSearch: fullName.toLowerCase(),
      birthYear: 2014,
      state,
      totalPoints: 100,
    }))
  );
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

describe("GET /api/rankings/suggest", () => {
  it("offers players whose first or second name starts with the term, best rank first", async () => {
    const res = await suggest("vik");
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((p: { fullName: string }) => p.fullName),
      ["Vikram Rao", "Aarav Vikranth", "Vikas Mehta"]
    );
  });

  it("matches the second name part too, and ignores archived weeks", async () => {
    const res = await suggest("vikr");
    assert.deepEqual(
      res.body.data.map((p: { regNo: string }) => p.regNo),
      ["200001", "200002"]
    );
  });

  it("carries only public fields", async () => {
    const [first] = (await suggest("vikram")).body.data;
    assert.deepEqual(Object.keys(first).sort(), ["fullName", "rank", "regNo", "state"]);
  });

  it("narrows by state", async () => {
    const res = await suggest("vik", "&state=Goa");
    assert.deepEqual(
      res.body.data.map((p: { regNo: string }) => p.regNo),
      ["200002"]
    );
  });

  it("returns nothing for a one-letter term and survives regex characters", async () => {
    assert.deepEqual((await suggest("v")).body.data, []);
    const odd = await suggest("vik(");
    assert.equal(odd.status, 200);
    assert.deepEqual(odd.body.data, []);
  });

  it("requires a category and subcategory", async () => {
    const res = await request(app).get("/api/rankings/suggest?q=vik");
    assert.equal(res.status, 400);
  });
});
