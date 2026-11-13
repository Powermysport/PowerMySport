// The AICF sweep end to end against a real (in-memory) MongoDB and a stub page.
//
// Pinned: a report writes nothing, an apply creates and matches, a second apply
// changes nothing, a page that has shrunk to a handful of rows is refused before
// anything is read from the database, and a failed backup stops every write.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { syncAicfCalendar } = require("../shared/services/aicf/AicfCalendarSyncService");
const { AicfEventsSource } = require("../shared/services/aicf/AicfEventsSource");
const { EVENTS_PAGE } = require("./fixtures/aicfEvents");

let memoryServer: { getUri(): string; stop(): Promise<void> };
const col = () => mongoose.connection.db.collection("tournamenteditions");
const NOW = new Date("2026-11-14T03:00:00.000Z");

/** The fixture's rows repeated under fresh codes, so the page clears the size check. */
function bigPage(): string {
  const rowsHtml = EVENTS_PAGE.match(/<tr><td>[\s\S]*?<\/tr>/g)!.join("\n");
  const copies: string[] = [];
  for (let i = 0; i < 9; i += 1) {
    // Copies are dated in the past, so they pad the page without becoming events.
    copies.push(
      rowsHtml
        .replace(
          /<td>(\d{6})<\/td>/g,
          (_m: string, code: string) => `<td>${Number(code) + (i + 1) * 1000000}</td>`
        )
        .replace(/-11-2026/g, "-01-2026")
        .replace(
          />([^<]+?)<\/td><td>(\d{7,8})/g,
          (_m: string, name: string, code: string) => `>${name} copy ${i}</td><td>${code}`
        )
    );
  }
  return EVENTS_PAGE.replace("</tbody>", `${copies.join("\n")}</tbody>`);
}

const source = (html: string) =>
  new AicfEventsSource({ fetchHtml: async () => ({ status: 200, body: html }) });
const sweep = (options: Record<string, unknown> = {}, html = bigPage()) =>
  syncAicfCalendar(
    { db: mongoose.connection.db, source: source(html) },
    { apply: true, now: NOW, ...options }
  );

describe("syncAicfCalendar", () => {
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
  });

  it("writes nothing in report mode", async () => {
    const report = await sweep({ apply: false });
    assert.equal(report.applied, false);
    assert.equal(report.plan.creates.length, 5);
    assert.equal(await col().countDocuments(), 0);
  });

  it("creates upcoming events, matches a stored row, and a second sweep changes nothing", async () => {
    await col().insertOne({
      sportSlug: "chess",
      name: "Eight Square Chess Academy - 3rd International FIDE Rated (Below 1700) Chess Tournament (Chennai)",
      slug: "kept-slug-2026-11-13",
      startDate: new Date("2026-11-13T00:00:00.000Z"),
      city: "Chennai",
      sourceUrl: "https://aicf.in/all-events/",
      status: "announced",
    });

    const first = await sweep();
    assert.equal(first.written.created, 4);
    assert.equal(first.written.updated, 1);
    const kept = await col().findOne({ slug: "kept-slug-2026-11-13" });
    assert.equal(kept.externalId, "485052");
    assert.equal(kept.federationSlug, "aicf");
    assert.equal(kept.city, "Chennai");

    const second = await sweep();
    assert.equal(second.written.created, 0);
    assert.equal(second.written.updated, 0);
    assert.equal(await col().countDocuments({ sportSlug: "chess" }), 5);
  });

  it("refuses a page that has shrunk, before touching the database", async () => {
    await assert.rejects(sweep({}, EVENTS_PAGE), /page has probably changed/);
    assert.equal(await col().countDocuments(), 0);
  });

  it("writes nothing when the backup fails", async () => {
    await col().insertOne({
      sportSlug: "chess",
      name: "24th BRDCA Rapid",
      startDate: new Date("2026-11-07T00:00:00.000Z"),
      externalId: "504949",
      sourceUrl: "x",
      status: "announced",
    });
    await assert.rejects(
      sweep({
        backup: () => {
          throw new Error("disk full");
        },
      }),
      /disk full/
    );
    assert.equal(await col().countDocuments(), 1);
    const row = await col().findOne({ externalId: "504949" });
    assert.equal(row.startDate.toISOString().slice(0, 10), "2026-11-07");
  });
});
