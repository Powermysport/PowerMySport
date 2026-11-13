// Migration 74 against a real (in-memory) MongoDB: a dry run writes nothing,
// apply redirects and re-points an existing redirect past the loser, a second
// apply changes nothing, and --down undoes only this migration's redirects.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { up, down } = require("../migrations/74_merge_chess_duplicates_into_aicf");

let memoryServer: { getUri(): string; stop(): Promise<void> };
const db = () => mongoose.connection.db;
const col = () => db().collection("tournamenteditions");
const quiet = () => undefined;
const day = new Date("2026-12-25T00:00:00.000Z");

async function seed() {
  await col().insertMany([
    {
      sportSlug: "chess",
      slug: "ramabai-coded-2026-12-25",
      name: "3rd Ramabai Ranade FIDE Classical Rating Chess Tournament",
      startDate: day,
      externalId: "480521",
      sourceUrl: "https://aicf.in/all-events/",
    },
    {
      sportSlug: "chess",
      slug: "ramabai-short-2026-12-25",
      name: "3rd Ramabai Ranade Maharashtra",
      startDate: day,
      organiser: "Ranade Trust",
      sourceUrl: "https://aicf.in/all-events/",
    },
    {
      // An older redirect (from migration 41) that pointed at the row about to be merged.
      sportSlug: "chess",
      slug: "ramabai-older-2026-12-25",
      name: "3rd Ramabai Ranade (Maharashtra)",
      startDate: day,
      mergedInto: "ramabai-short-2026-12-25",
      sourceUrl: "https://aicf.in/all-events/",
    },
  ]);
}

describe("migration 74", () => {
  before(async () => {
    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri(), { autoIndex: false });
  });
  after(async () => {
    await mongoose.disconnect();
    await memoryServer.stop();
  });
  beforeEach(async () => {
    await col().deleteMany({});
    await seed();
  });

  it("writes nothing in a dry run", async () => {
    const { plan } = await up(db(), { apply: false, log: quiet });
    assert.equal(plan.merges.length, 1);
    assert.equal(await col().countDocuments({ mergedReason: { $exists: true } }), 0);
  });

  it("refuses to apply without a backup", async () => {
    await assert.rejects(up(db(), { apply: true, log: quiet }), /backup/);
    assert.equal(await col().countDocuments({ mergedReason: { $exists: true } }), 0);
  });

  it("redirects, copies facts, re-points the older redirect, and is idempotent", async () => {
    let backedUp = 0;
    const first = await up(db(), {
      apply: true,
      log: quiet,
      backup: (rows: unknown[]) => (backedUp = rows.length),
    });
    assert.equal(backedUp, 3);
    assert.deepEqual(first.written, { merged: 1, filled: 1, repointed: 1 });

    const loser = await col().findOne({ slug: "ramabai-short-2026-12-25" });
    assert.equal(loser.mergedInto, "ramabai-coded-2026-12-25");
    const older = await col().findOne({ slug: "ramabai-older-2026-12-25" });
    assert.equal(older.mergedInto, "ramabai-coded-2026-12-25");
    const survivor = await col().findOne({ slug: "ramabai-coded-2026-12-25" });
    assert.equal(survivor.organiser, "Ranade Trust");

    const second = await up(db(), { apply: true, log: quiet, backup: () => undefined });
    assert.deepEqual(second.written, { merged: 0, filled: 0, repointed: 0 });
  });

  it("down clears only this migration's redirects", async () => {
    await up(db(), { apply: true, log: quiet, backup: () => undefined });
    await down(db(), quiet);
    const loser = await col().findOne({ slug: "ramabai-short-2026-12-25" });
    assert.equal(loser.mergedInto, undefined);
    // The migration-41 redirect was re-pointed, not created here, so it stays a redirect.
    const older = await col().findOne({ slug: "ramabai-older-2026-12-25" });
    assert.ok(older.mergedInto);
  });
});
