// The rules behind migration 74, which redirects duplicate chess rows to the row
// AICF's event code owns. A wrong merge sends one tournament's page to another,
// so the cases that must NOT merge matter most. Names are verbatim from the
// stored rows and AICF's page on 2026-11-14.

import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { planChessDuplicateMerges } = require("../shared/services/aicf/chessDuplicates");

const AICF = "https://aicf.in/all-events/";
let n = 0;
const coded = (name: string, day: string, code: string, extra: Record<string, unknown> = {}) => ({
  _id: `c${(n += 1)}`,
  slug: `coded-${code}`,
  name,
  officialName: name,
  startDate: new Date(`${day}T00:00:00.000Z`),
  externalId: code,
  sourceUrl: AICF,
  ...extra,
});
const legacy = (name: string, day: string, extra: Record<string, unknown> = {}) => ({
  _id: `l${(n += 1)}`,
  slug: `legacy-${n}`,
  name,
  startDate: new Date(`${day}T00:00:00.000Z`),
  sourceUrl: AICF,
  ...extra,
});

describe("planChessDuplicateMerges", () => {
  it("merges a short spelling of a category into its coded row", () => {
    const survivor = coded(
      "1st Akshaya International Grandmaster Open Chess Tournament – 2027 (Category B) below 2000",
      "2027-01-11",
      "482207"
    );
    const dupe = legacy(
      "1st Akshaya International Grandmaster Open Cat B below 2000 Coimbatore",
      "2027-01-11"
    );
    const other = coded(
      "1st Akshaya International Grandmaster Open Chess Tournament – 2027 (Category A) above 2000",
      "2027-01-11",
      "482202"
    );
    const plan = planChessDuplicateMerges([survivor, dupe, other]);
    assert.equal(plan.merges.length, 1);
    assert.equal(plan.merges[0].loser._id, dupe._id);
    assert.equal(plan.merges[0].survivor.slug, "coded-482207");
  });

  it("never merges one category into another", () => {
    const a = coded(
      "1st Akshaya International Grandmaster Open Chess Tournament – 2027 (Category A) above 2000",
      "2027-01-11",
      "482202"
    );
    const b = legacy(
      "1st Akshaya International Grandmaster Open Cat B below 2000 Coimbatore",
      "2027-01-11"
    );
    assert.equal(planChessDuplicateMerges([a, b]).merges.length, 0);
  });

  it("never merges blitz into classical", () => {
    const classical = coded(
      "3rd Bhilwara International Open FIDE Classical Rating Chess Tournament 2026",
      "2026-12-25",
      "471849"
    );
    const blitz = legacy(
      "3rd Bhilwara International Open FIDE Blitz Rating Chess Tournament",
      "2026-12-25"
    );
    assert.equal(planChessDuplicateMerges([classical, blitz]).merges.length, 0);
  });

  it("merges a festival row naming no category when only one event of that name runs that day", () => {
    const survivor = coded(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Category – C Blitz)",
      "2026-12-25",
      "482570"
    );
    const festival = legacy(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Madurai)",
      "2026-12-25"
    );
    const plan = planChessDuplicateMerges([survivor, festival]);
    assert.equal(plan.merges.length, 1);
    assert.match(plan.merges[0].reason, /only event/);
  });

  it("reports a festival row as ambiguous when two categories run that day", () => {
    const a = coded(
      "Athens of the East 6th International Grandmaster Chess Tournaments – (Category – A Above 2100)",
      "2026-12-22",
      "482567"
    );
    const b = coded(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Category – B Below 2100)",
      "2026-12-22",
      "482568"
    );
    const festival = legacy(
      "Athens of the East 6th International Grandmaster Open Chess Tournament (Madurai)",
      "2026-12-22"
    );
    const plan = planChessDuplicateMerges([a, b, festival]);
    assert.equal(plan.merges.length, 0);
    assert.equal(plan.ambiguous.length, 1);
    assert.equal(plan.ambiguous[0].candidates.length, 2);
  });

  it("merges a short name that drops the format, when only one event that day fits it", () => {
    const survivor = coded(
      "2nd MAHARATHI INTERNATIONAL BELOW 1800 CLASSICAL FIDE RATED CHESS TOURNAMENT",
      "2027-03-26",
      "471844"
    );
    const short = legacy("2nd Maharathi International Below 1800 Delhi", "2027-03-26");
    const plan = planChessDuplicateMerges([survivor, short]);
    assert.equal(plan.merges.length, 1);
    assert.match(plan.merges[0].reason, /fewer qualifiers/);
  });

  it("reports a short name as ambiguous when classical and blitz of it both run that day", () => {
    const classical = coded(
      "2nd Maharathi International Below 1800 Classical Chess Tournament",
      "2027-03-26",
      "1"
    );
    const blitz = coded(
      "2nd Maharathi International Below 1800 Blitz Chess Tournament",
      "2027-03-26",
      "2"
    );
    const short = legacy("2nd Maharathi International Below 1800 Delhi", "2027-03-26");
    const plan = planChessDuplicateMerges([classical, blitz, short]);
    assert.equal(plan.merges.length, 0);
    assert.equal(plan.ambiguous.length, 1);
  });

  it("never merges a row naming a qualifier the coded row lacks", () => {
    const survivor = coded(
      "2nd Maharathi International Below 1800 Chess Tournament",
      "2027-03-26",
      "471844"
    );
    const blitz = legacy("2nd Maharathi International Below 1800 Blitz Delhi", "2027-03-26");
    assert.equal(planChessDuplicateMerges([survivor, blitz]).merges.length, 0);
  });

  it("reads AICF's curly-quoted category letters, so two categories are never confused", () => {
    const a = coded(
      "22nd Delhi International Open Grandmasters Chess Tournament – 2027 (Category ‘A’)",
      "2027-01-21",
      "484271"
    );
    const b = legacy(
      "22nd Delhi International Open Grandmasters Chess Tournament - 2027 (Category 'B')",
      "2027-01-21"
    );
    assert.equal(planChessDuplicateMerges([a, b]).merges.length, 0);
  });

  it("leaves rows from other sources alone, even when they look identical", () => {
    const survivor = coded(
      "3rd Ramabai Ranade FIDE Classical Rating Chess Tournament",
      "2026-12-25",
      "480521"
    );
    const curated = legacy("3rd Ramabai Ranade Maharashtra", "2026-12-25", {
      sourceUrl: "https://example.org/listing",
    });
    assert.equal(planChessDuplicateMerges([survivor, curated]).merges.length, 0);
  });

  it("never merges across days", () => {
    const survivor = coded(
      "3rd Ramabai Ranade FIDE Classical Rating Chess Tournament",
      "2026-12-25",
      "480521"
    );
    const other = legacy("3rd Ramabai Ranade Maharashtra", "2026-12-26");
    assert.equal(planChessDuplicateMerges([survivor, other]).merges.length, 0);
  });

  it("copies facts the survivor lacks, and never overwrites ones it has", () => {
    const survivor = coded(
      "3rd Ramabai Ranade FIDE Classical Rating Chess Tournament",
      "2026-12-25",
      "480521",
      {
        venue: "Kept Hall",
        documents: [{ label: "Brochure", url: "https://aicf.in/a.pdf", kind: "factSheet" }],
      }
    );
    const dupe = legacy("3rd Ramabai Ranade Maharashtra", "2026-12-25", {
      venue: "Other Hall",
      organiser: "Ranade Trust",
      documents: [
        { label: "Brochure", url: "https://aicf.in/a.pdf", kind: "factSheet" },
        { label: "Entry form", url: "https://aicf.in/b.pdf", kind: "entryForm" },
      ],
    });
    const fill = planChessDuplicateMerges([survivor, dupe]).fills.get("coded-480521");
    assert.deepEqual(fill.changed.sort(), ["documents", "organiser"]);
    assert.equal(fill.set.organiser, "Ranade Trust");
    assert.equal("venue" in fill.set, false);
    assert.equal(fill.set.documents.length, 2);
  });

  it("finds nothing to do on rows already merged", () => {
    const survivor = coded(
      "3rd Ramabai Ranade FIDE Classical Rating Chess Tournament",
      "2026-12-25",
      "480521"
    );
    const done = legacy("3rd Ramabai Ranade Maharashtra", "2026-12-25", {
      mergedInto: "coded-480521",
    });
    assert.equal(planChessDuplicateMerges([survivor, done]).merges.length, 0);
  });
});
