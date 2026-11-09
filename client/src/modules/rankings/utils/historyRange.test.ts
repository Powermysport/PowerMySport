import { describe, expect, it } from "vitest";
import { inHistoryRange, isRangeSet, presetFrom, readHistoryRange } from "./historyRange";

describe("readHistoryRange", () => {
  it("keeps valid dates and drops malformed ones", () => {
    expect(readHistoryRange({ from: "2025-06-02", to: "2025-12-08" })).toEqual({
      from: "2025-06-02",
      to: "2025-12-08",
    });
    expect(readHistoryRange({ from: "June", to: "2025-13-40" })).toEqual({ from: null, to: null });
    expect(isRangeSet(readHistoryRange({}))).toBe(false);
  });

  it("swaps a reversed pair instead of showing nothing", () => {
    expect(readHistoryRange({ from: "2025-12-08", to: "2025-06-02" })).toEqual({
      from: "2025-06-02",
      to: "2025-12-08",
    });
  });
});

describe("inHistoryRange", () => {
  const range = { from: "2025-06-02", to: "2025-12-08" };
  it("is inclusive at both ends and reads full timestamps", () => {
    expect(inHistoryRange("2025-06-02T00:00:00.000Z", range)).toBe(true);
    expect(inHistoryRange("2025-12-08", range)).toBe(true);
    expect(inHistoryRange("2025-05-26", range)).toBe(false);
    expect(inHistoryRange("2025-12-15", range)).toBe(false);
  });

  it("treats a missing end as open", () => {
    expect(inHistoryRange("2020-01-01", { from: null, to: "2025-12-08" })).toBe(true);
    expect(inHistoryRange("2030-01-01", { from: "2025-06-02", to: null })).toBe(true);
  });
});

describe("presetFrom", () => {
  it("counts back whole months from the newest week held", () => {
    expect(presetFrom("2026-09-21", 3)).toBe("2026-06-21");
    expect(presetFrom("2026-09-21T00:00:00.000Z", 12)).toBe("2025-09-21");
  });

  it("clamps to the end of a shorter month", () => {
    expect(presetFrom("2026-05-31", 3)).toBe("2026-02-28");
  });
});
