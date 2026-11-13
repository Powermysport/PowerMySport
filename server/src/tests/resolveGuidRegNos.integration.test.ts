/* eslint-disable @typescript-eslint/no-var-requires */
// GUID-keyed rows must land on the AITA number we already hold, and must never
// be merged on an ambiguous name.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { resolveGuidRegNos } = require("../shared/services/aita/resolveGuidRegNos");
const { provisionalRegNo } = require("../shared/services/aita/rankingListParser");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingSnapshot } = require("../shared/models/RankingSnapshot");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const G = (n: number) => `0000000${n}-0000-0000-0000-000000000000`;
const row = (guid: string, fullName: string, birthYear: number, stateCode: string) => ({
  rank: 1,
  fullName,
  birthYear,
  stateCode,
  playerKey: guid,
  regNo: provisionalRegNo(guid),
});

describe("resolveGuidRegNos", () => {
  before(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
    const snap = await RankingSnapshot.collection.insertOne({
      category: "BS",
      subcategory: "U12",
      asOnDate: new Date("2026-10-12"),
      status: "published",
      version: 1,
    });
    await RankingEntry.collection.insertMany(
      [
        { regNo: "440090", fullName: "Riaan NANDANKAR", birthYear: 2014, stateCode: "GJ" },
        { regNo: "500001", fullName: "Same NAME", birthYear: 2013, stateCode: "MH" },
        { regNo: "500002", fullName: "Same NAME", birthYear: 2013, stateCode: "MH" },
        {
          regNo: "500003",
          fullName: "Known BYGUID",
          birthYear: 2012,
          stateCode: "DL",
          playerKey: G(9),
        },
      ].map((e) => ({ ...e, snapshot: snap.insertedId, category: "BS", subcategory: "U12" }))
    );
  });

  after(async () => {
    await mongoose.disconnect();
    await memoryServer.stop();
  });

  it("matches by GUID, then by unique identity, and leaves the rest provisional", async () => {
    const rows = [
      row(G(1), "riaan  nandankar", 2014, "gj"),
      row(G(2), "Same NAME", 2013, "MH"),
      row(G(3), "Brand NEW", 2014, "KA"),
      row(G(9), "Renamed PLAYER", 2012, "DL"),
    ];
    const out = await resolveGuidRegNos({
      category: "BS",
      subcategory: "U12",
      asOnDate: "2026-10-19",
      rows,
    });
    assert.equal(rows[0]!.regNo, "440090");
    assert.equal(rows[1]!.regNo, provisionalRegNo(G(2)), "ambiguous name must not merge");
    assert.equal(rows[2]!.regNo, provisionalRegNo(G(3)));
    assert.equal(rows[3]!.regNo, "500003", "a stored GUID wins even if the name changed");
    assert.deepEqual(out, { matched: 2, provisional: 2, ambiguous: 1 });
  });

  it("leaves every row provisional when there is no earlier week", async () => {
    const rows = [row(G(1), "Riaan NANDANKAR", 2014, "GJ")];
    const out = await resolveGuidRegNos({
      category: "BS",
      subcategory: "U12",
      asOnDate: "2026-10-05",
      rows,
    });
    assert.equal(rows[0]!.regNo, provisionalRegNo(G(1)));
    assert.equal(out.provisional, 1);
  });
});
