import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { oneRowPerWeek } = require("../shared/services/ranking/oneRowPerWeek");

const row = (snapshot: string, date: string, rank: number, subcategory = "U-16") => ({
  category: "Boys",
  subcategory,
  asOnDate: new Date(date),
  rank,
  snapshot,
});

describe("oneRowPerWeek", () => {
  it("returns the history untouched when no week is duplicated", () => {
    const history = [row("a", "2026-08-31", 10), row("b", "2026-08-24", 12)];
    assert.deepEqual(oneRowPerWeek(history, new Map()), history);
  });

  it("keeps only the highest snapshot version for a repeated week", () => {
    const history = [
      row("old", "2026-08-31", 10),
      row("fixed", "2026-08-31", 8),
      row("other", "2026-08-24", 12),
    ];
    const versions = new Map([
      ["old", 1],
      ["fixed", 2],
    ]);
    assert.deepEqual(
      oneRowPerWeek(history, versions).map((r: { snapshot: string }) => r.snapshot),
      ["fixed", "other"]
    );
  });

  it("ranks a snapshot that never published below every published one", () => {
    const history = [row("draft", "2026-08-31", 5), row("live", "2026-08-31", 9)];
    const versions = new Map([
      ["draft", -1],
      ["live", 1],
    ]);
    assert.deepEqual(
      oneRowPerWeek(history, versions).map((r: { snapshot: string }) => r.snapshot),
      ["live"]
    );
  });

  it("treats the same date in two different lists as two weeks, not a duplicate", () => {
    const history = [
      row("u16", "2026-08-31", 10, "U-16"),
      row("u18", "2026-08-31", 20, "U-18"),
      row("u16b", "2026-08-31", 9, "U-16"),
    ];
    const versions = new Map([
      ["u16", 1],
      ["u16b", 2],
    ]);
    assert.deepEqual(
      oneRowPerWeek(history, versions).map((r: { snapshot: string }) => r.snapshot),
      ["u18", "u16b"]
    );
  });
});
