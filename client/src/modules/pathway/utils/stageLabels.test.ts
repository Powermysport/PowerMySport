import { describe, expect, it } from "vitest";
import { ageArticle, ageSpan, compactAgeRange, shortStageName, stageHref } from "./stageLabels";

describe("shortStageName", () => {
  it("drops the sport name a stage repeats", () => {
    expect(shortStageName("Discover Tennis", "Tennis")).toBe("Discover");
    expect(shortStageName("Discover table tennis", "Table Tennis")).toBe("Discover");
  });
  it("leaves names without the sport alone", () => {
    expect(shortStageName("Learn & Develop", "Chess")).toBe("Learn & Develop");
  });
  it("never returns an empty name", () => {
    expect(shortStageName("Chess", "Chess")).toBe("Chess");
  });
});

describe("compactAgeRange", () => {
  it("normalises the formats authors write", () => {
    expect(compactAgeRange("Age 4–7")).toBe("4–7");
    expect(compactAgeRange("~5-8")).toBe("~5–8");
    expect(compactAgeRange("Ages 10 - 14")).toBe("10–14");
    expect(compactAgeRange("18+")).toBe("18+");
  });
});

describe("ageSpan", () => {
  it("reads first and last stage", () => {
    expect(ageSpan([{ ageRange: "Age 4–7" }, { ageRange: "18+" }])).toBe("Ages 4 to 18+");
    expect(ageSpan([{ ageRange: "~5-8" }, { ageRange: "~15-18" }])).toBe("Ages ~5 to 18");
  });
  it("is null with no stages", () => {
    expect(ageSpan([])).toBeNull();
  });
});

describe("ageArticle", () => {
  it("uses an before ages said with a vowel sound", () => {
    expect(ageArticle(8)).toBe("an");
    expect(ageArticle(11)).toBe("an");
    expect(ageArticle(18)).toBe("an");
    expect(ageArticle(9)).toBe("a");
    expect(ageArticle(12)).toBe("a");
  });
});

describe("stageHref", () => {
  it("links a stage, or the sport when there is none", () => {
    expect(stageHref("tennis", "compete")).toBe("/roadmap/tennis?stage=compete");
    expect(stageHref("tennis")).toBe("/roadmap/tennis");
  });
});
