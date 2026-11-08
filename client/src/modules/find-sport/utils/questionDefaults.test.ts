import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS } from "../types";
import { defaultHeightCm, defaultWeightKg, displayedDefault } from "./questionDefaults";

describe("displayedDefault", () => {
  const age10 = { ...EMPTY_ANSWERS, age: 10 };

  it("records the height shown on screen when the parent continues without moving the slider", () => {
    expect(displayedDefault("height", age10)).toEqual({ key: "height", value: 140 });
  });

  it("records the weight shown on screen when the parent continues without moving the slider", () => {
    expect(displayedDefault("weight", age10)).toEqual({ key: "weight", value: 40 });
  });

  it("never overwrites a value the parent set", () => {
    expect(displayedDefault("height", { ...age10, height: 151 })).toBeNull();
    expect(displayedDefault("weight", { ...age10, weight: 33 })).toBeNull();
  });

  it("does nothing on other screens", () => {
    expect(displayedDefault("energyType", age10)).toBeNull();
  });

  it("matches the value the screen displays when the age is unknown", () => {
    expect(defaultHeightCm(null)).toBe(130);
    expect(defaultWeightKg(null)).toBe(35);
  });
});
