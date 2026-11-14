import { describe, expect, it } from "vitest";

import type { PlayerResult } from "../services/api";
import { playerTitle } from "./playerTitle";

const entry = (subcategory: string, rank: number) => ({
  category: "Boys",
  subcategory,
  rank,
});

const twoLists = {
  player: { regNo: "447854", fullName: "VIKRANT KHANDELWAL" },
  current: [entry("U-16", 12), entry("U-18", 40)],
  history: [],
} as unknown as PlayerResult;

describe("playerTitle", () => {
  it("names the own age group by default", () => {
    expect(playerTitle(twoLists, "AITA")).toContain("rank #12");
  });

  it("names the list ?list= picked", () => {
    expect(playerTitle(twoLists, "AITA", "U-18")).toContain("rank #40");
  });

  it("falls back to the own age group for an unknown list", () => {
    expect(playerTitle(twoLists, "AITA", "U-99")).toContain("rank #12");
  });
});
