// Unit tests for reading AICF's "All Events" page and deciding what to store.
// No database, no network: the parser and the plan are both pure.
//
// What is pinned: rows AICF got wrong are refused with a reason rather than
// stored, a stored row keeps its name and slug and only has EMPTY fields filled,
// a second run changes nothing, finished events are ignored, and nothing is
// ever planned as a cancellation.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  parseAicfEventsPage,
  parseAicfDate,
  splitPlace,
} = require("../shared/services/aicf/aicfEventsParser");
const {
  planAicfIngest,
  levelFromName,
  ageGroupsFromName,
  nameSimilarity,
} = require("../shared/services/aicf/aicfIngest");
const { EVENTS_PAGE } = require("./fixtures/aicfEvents");

const NOW = new Date("2026-11-14T03:00:00.000Z");
const page = parseAicfEventsPage(EVENTS_PAGE);
const row = (code: string) => page.rows.find((r: { eventCode: string }) => r.eventCode === code);

const run = (over: Record<string, unknown> = {}) =>
  planAicfIngest({ rows: page.rows, stored: [], takenSlugs: new Set<string>(), now: NOW, ...over });

describe("parseAicfEventsPage", () => {
  it("reads every event row and decodes AICF's entities", () => {
    assert.equal(page.rows.length, 7);
    assert.equal(
      row("485052").name,
      "Eight Square Chess Academy – 3rd International FIDE Rated (Below 1700) Chess Tournament 2026"
    );
    assert.equal(row("504571").name.startsWith("Yuva’s 1st"), true);
  });

  it("rejects a row whose end date is before its start, with the reason", () => {
    const bad = page.rejected.find((r: { eventCode: string }) => r.eventCode === "471361");
    assert.ok(bad);
    assert.match(bad.reason, /before it starts/);
    assert.equal(row("471361"), undefined);
  });

  it("rejects a row with no event code instead of inventing a key", () => {
    const bad = page.rejected.find((r: { name: string }) => r.name.startsWith("National Under-11"));
    assert.ok(bad);
    assert.match(bad.reason, /no event code/);
  });

  it("splits the place into city and canonical state", () => {
    assert.deepEqual(splitPlace("Pune, Maharashtra"), { city: "Pune", state: "Maharashtra" });
    assert.deepEqual(splitPlace("Andhra Pradesh"), { state: "Andhra Pradesh" });
    assert.deepEqual(splitPlace("Chennai"), { city: "Chennai" });
    assert.deepEqual(splitPlace("Delhi"), { city: "Delhi", state: "Delhi" });
    assert.deepEqual(splitPlace("Varanasi, UP"), { city: "Varanasi", state: "Uttar Pradesh" });
    assert.equal(row("473870").city, "Banka");
    assert.equal(row("473870").state, "Bihar");
  });

  it("keeps the brochure link, including one that is an image", () => {
    assert.match(row("488296").brochureUrl, /\.jpg$/);
    assert.equal(row("473870").brochureUrl, undefined);
  });

  it("refuses dates that are not real days", () => {
    assert.equal(parseAicfDate("31-02-2026"), null);
    assert.equal(parseAicfDate("05-04-2026"), "2026-04-05");
  });
});

describe("reading the name", () => {
  it("finds the level and the entry bands the name states", () => {
    assert.equal(levelFromName("3rd International FIDE Rated (Below 1700)"), "International");
    assert.equal(levelFromName("WB State Under 17 Open"), "State");
    assert.equal(levelFromName("24th BRDCA ALL INDIA OPEN"), undefined);
    assert.deepEqual(ageGroupsFromName("International FIDE Rated (Below 1700) Chess"), [
      "Below 1700",
    ]);
    assert.deepEqual(ageGroupsFromName("WB State Under 17 Open"), ["Under-17"]);
    assert.deepEqual(ageGroupsFromName("U-9 and U-11 Rapid"), ["Under-9", "Under-11"]);
    assert.deepEqual(ageGroupsFromName("24th BRDCA ALL INDIA OPEN"), []);
  });

  it("scores the same event under two spellings as similar, and different events as not", () => {
    assert.equal(
      nameSimilarity(
        "Eight Square Chess Academy - 3rd International FIDE Rated (Below 1700) Chess Tournament (Chennai)",
        "Eight Square Chess Academy – 3rd International FIDE Rated (Below 1700) Chess Tournament 2026"
      ) >= 0.5,
      true
    );
    assert.equal(
      nameSimilarity("24th BRDCA Rapid", "Yuva’s 1st Global Chess Fest Rapid") < 0.5,
      true
    );
  });
});

describe("planAicfIngest", () => {
  it("creates every upcoming event and ignores finished ones", () => {
    const plan = run();
    assert.equal(plan.finished, 2); // the two April events
    assert.deepEqual(plan.creates.map((c: { eventCode: string }) => c.eventCode).sort(), [
      "485052",
      "488296",
      "495841",
      "504571",
      "504949",
    ]);
    const c = plan.creates.find((x: { eventCode: string }) => x.eventCode === "485052").doc;
    assert.equal(c.sportSlug, "chess");
    assert.equal(c.federationSlug, "aicf");
    assert.equal(c.externalId, "485052");
    assert.equal(c.slug.endsWith("-2026-11-13"), true);
    assert.equal(c.level, "International");
    assert.deepEqual(c.ageGroups, ["Below 1700"]);
    assert.deepEqual(c.documents, [
      {
        label: "Brochure",
        url: "https://aicf.in/wp-content/uploads/2026/08/ECA_Below1700_Nov2026.pdf",
        kind: "factSheet",
      },
    ]);
    // Started yesterday, still running.
    const ongoing = plan.creates.find((x: { eventCode: string }) => x.eventCode === "488296").doc;
    assert.equal(ongoing.status, "ongoing");
  });

  it("matches an admin-extracted row by date and name, keeps its name and slug, fills only empty fields", () => {
    const stored = [
      {
        _id: "s1",
        name: "Eight Square Chess Academy - 3rd International FIDE Rated (Below 1700) Chess Tournament (Chennai)",
        slug: "eight-square-old-slug-2026-11-13",
        startDate: new Date("2026-11-13T00:00:00.000Z"),
        endDate: new Date("2026-11-15T00:00:00.000Z"),
        city: "Chennai",
        level: "International",
        ageGroups: ["Below 1700"],
        federationSlug: "aicf",
      },
    ];
    const plan = run({ stored });
    assert.equal(
      plan.creates.some((c: { eventCode: string }) => c.eventCode === "485052"),
      false
    );
    const u = plan.updates.find((x: { id: string }) => x.id === "s1");
    assert.equal(u.matchedBy, "name");
    assert.deepEqual(u.changed.sort(), ["documents", "externalId", "officialName"]);
    assert.equal("name" in u.set, false);
    assert.equal("slug" in u.set, false);
    assert.equal("city" in u.set, false);
  });

  it("never matches the same name more than 45 days away: that is another year's edition", () => {
    const stored = [
      {
        _id: "s1",
        name: "24th BRDCA ALL INDIA OPEN FIDE RATED RAPID CHESS TOURNAMENT 2026",
        startDate: new Date("2027-01-14T00:00:00.000Z"),
      },
    ];
    const plan = run({ stored });
    assert.equal(plan.updates.length, 0);
    assert.equal(
      plan.creates.some((c: { eventCode: string }) => c.eventCode === "504949"),
      true
    );
  });

  it("is idempotent: planning again over its own creates changes nothing", () => {
    const first = run();
    const stored = first.creates.map((c: { doc: Record<string, unknown> }, i: number) => ({
      _id: `c${i}`,
      ...c.doc,
    }));
    const second = run({ stored });
    assert.equal(second.creates.length, 0);
    assert.equal(second.updates.length, first.creates.length);
    for (const u of second.updates) assert.deepEqual(u.changed, []);
  });

  it("moves the dates of a row it owns when AICF moves the event", () => {
    const stored = [
      {
        _id: "s1",
        name: "24th BRDCA Rapid",
        startDate: new Date("2026-11-07T00:00:00.000Z"),
        endDate: new Date("2026-11-07T00:00:00.000Z"),
        externalId: "504949",
      },
    ];
    const u = run({ stored }).updates.find((x: { id: string }) => x.id === "s1");
    assert.equal(u.matchedBy, "eventCode");
    assert.deepEqual(u.set.startDate, new Date("2026-11-14T00:00:00.000Z"));
    assert.ok(u.changed.includes("endDate"));
  });

  it("corrects the dates of a stored event AICF has moved, when the name is all but identical", () => {
    const stored = [
      {
        _id: "s1",
        name: "24th BRDCA ALL INDIA OPEN FIDE RATED RAPID CHESS TOURNAMENT 2026",
        slug: "brdca-kept-2026-10-31",
        startDate: new Date("2026-10-31T00:00:00.000Z"),
      },
    ];
    const plan = run({ stored });
    const u = plan.updates.find((x: { id: string }) => x.id === "s1");
    assert.equal(u.matchedBy, "moved");
    assert.deepEqual(u.set.startDate, new Date("2026-11-14T00:00:00.000Z"));
    assert.equal("slug" in u.set, false);
    assert.equal(
      plan.creates.some((c: { eventCode: string }) => c.eventCode === "504949"),
      false
    );
  });

  it("does not treat a loosely similar name on another day as a moved event", () => {
    const stored = [
      {
        _id: "s1",
        name: "24th BRDCA Blitz Festival",
        startDate: new Date("2026-11-07T00:00:00.000Z"),
      },
    ];
    const plan = run({ stored });
    assert.equal(plan.updates.length, 0);
  });

  it("claims one stored row per event and reports the leftover lookalikes as possible duplicates", () => {
    const day = new Date("2026-11-13T00:00:00.000Z");
    const stored = [
      {
        _id: "a",
        name: "Eight Square Chess Academy 3rd International FIDE Rated (Below 1700) Chess Tournament",
        startDate: day,
      },
      {
        _id: "b",
        name: "Eight Square Chess Academy 3rd International Below 1700 (Chennai)",
        startDate: day,
      },
    ];
    const plan = run({ stored });
    assert.equal(
      plan.updates.filter((u: { eventCode: string }) => u.eventCode === "485052").length,
      1
    );
    assert.equal(plan.possibleDuplicates.length, 1);
    assert.equal(plan.possibleDuplicates[0].likeEventCode, "485052");
  });

  it("reports an owned event AICF stopped listing, and plans no cancellation", () => {
    const stored = [
      {
        _id: "gone",
        name: "Vanished Open",
        startDate: new Date("2026-12-01T00:00:00.000Z"),
        externalId: "999999",
        status: "announced",
      },
    ];
    const plan = run({ stored });
    assert.equal(plan.missing.length, 1);
    assert.equal(
      plan.updates.some((u: { id: string }) => u.id === "gone"),
      false
    );
  });

  it("refuses an event dated more than the horizon out, which is a typo on AICF's side", () => {
    const far = {
      ...row("504949"),
      eventCode: "777777",
      startDate: "2028-11-14",
      endDate: "2028-11-14",
    };
    const plan = run({ rows: [...page.rows, far] });
    assert.equal(
      plan.creates.some((c: { eventCode: string }) => c.eventCode === "777777"),
      false
    );
    assert.equal(
      plan.skipped.some((s: { eventCode: string }) => s.eventCode === "777777"),
      true
    );
  });
});
