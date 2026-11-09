/* eslint-disable @typescript-eslint/no-var-requires */
// Comparing a ranking list with an earlier week (`since`) and ordering it by
// places gained (`sort=climbers`). In-memory MongoDB only.
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
const request = require("supertest");

const { app } = require("../app");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };

const JUNE = new Date(Date.UTC(2025, 5, 2));
const DEC = new Date(Date.UTC(2025, 11, 8));

const seedList = async (asOnDate: Date, isLatest: boolean, rows: Array<[string, number]>) => {
  const snapshot = await RankingSnapshot.create({
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory: "U-12",
    asOnDate,
    pdfUrl: "https://example.test/list",
    sourceUrl: "https://example.test",
    contentHash: `hash-${asOnDate.getTime()}`,
    status: "published",
    version: 1,
    isLatestForCombo: isLatest,
    rowCount: rows.length,
  });
  await RankingEntry.insertMany(
    rows.map(([regNo, rank]) => ({
      snapshot: snapshot._id,
      sportSlug: "tennis",
      federationCode: "AITA",
      category: "Boys",
      subcategory: "U-12",
      asOnDate,
      isLatest,
      rank,
      regNo,
      givenName: `P${regNo}`,
      familyName: "TEST",
      fullName: `P${regNo} TEST`,
      nameSearch: `p${regNo} test`,
      birthYear: 2014,
      state: "Delhi",
      stateCode: "DL",
      totalPoints: 1000 - rank,
    }))
  );
};

const list = (query: string) =>
  request(app).get(`/api/rankings?category=Boys&subcategory=U-12&${query}`);

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
  await Promise.all([RankingEntry.deleteMany({}), RankingSnapshot.deleteMany({})]);
  // June: A #1, B #2, C #3. December (latest): B #1, A #2, D #3 (new), C #4.
  await seedList(JUNE, false, [
    ["100001", 1],
    ["100002", 2],
    ["100003", 3],
  ]);
  await seedList(DEC, true, [
    ["100002", 1],
    ["100001", 2],
    ["100004", 3],
    ["100003", 4],
  ]);
});

const movement = (body: {
  data: { entries: Array<{ regNo: string; rankDelta: number | null }> };
}) => body.data.entries.map((e) => [e.regNo, e.rankDelta]);

describe("comparing a list with an earlier week", () => {
  it("measures each player's movement from that week, new players as null", async () => {
    const res = await list("since=2025-06-02").expect(200);
    assert.deepEqual(res.body.data.compare, { since: "2025-06-02" });
    assert.deepEqual(movement(res.body), [
      ["100002", 1],
      ["100001", -1],
      ["100004", null],
      ["100003", -1],
    ]);
  });

  it("orders by places gained, then new players, when asked for climbers", async () => {
    const res = await list("since=2025-06-02&sort=climbers").expect(200);
    assert.deepEqual(
      res.body.data.entries.map((e: { regNo: string }) => e.regNo),
      ["100002", "100001", "100003", "100004"]
    );
    assert.equal(res.body.data.pagination.total, 4);
  });

  it("pages the climbers order across the whole list", async () => {
    const res = await list("since=2025-06-02&sort=climbers&limit=2&page=2").expect(200);
    assert.deepEqual(
      res.body.data.entries.map((e: { regNo: string }) => e.regNo),
      ["100003", "100004"]
    );
  });

  it("ignores the climbers order without a week to compare with", async () => {
    const res = await list("sort=climbers").expect(200);
    assert.equal(res.body.data.compare, null);
    assert.deepEqual(
      res.body.data.entries.map((e: { rank: number }) => e.rank),
      [1, 2, 3, 4]
    );
  });

  it("refuses a week that is not earlier, a malformed date and a week we do not hold", async () => {
    await list("since=2025-12-08").expect(400);
    await list("date=2025-06-02&since=2025-12-08").expect(400);
    await list("since=June").expect(400);
    await list("since=2025-07-07").expect(404);
  });

  it("never puts a date of birth on the wire", async () => {
    const res = await list("since=2025-06-02&sort=climbers").expect(200);
    assert.doesNotMatch(JSON.stringify(res.body), /"dob"/);
  });
});
