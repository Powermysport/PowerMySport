import { describe, expect, it } from "vitest";
import { EMPTY_ANSWERS, type WizardAnswers } from "../types";
import { scoreChosenSports } from "./scorer";

const child: WizardAnswers = {
  ...EMPTY_ANSWERS,
  childName: "Aarav",
  age: 10,
  gender: "boy",
  state: "Karnataka",
  energyType: "explosive",
  visualTracking: "strong",
  agility: "high",
  teamIndividual: 2,
  decisionStyle: "react",
  budget: "7k-15k",
  ambition: "competitive",
  weeklyHours: "4-7",
};

const RACKET = ["Badminton", "Tennis", "Table Tennis"];

describe("eyesight: glasses are normal vision (audit F5)", () => {
  it("scores a child in glasses the same as one with uncorrected sharp vision", () => {
    const sharp = scoreChosenSports({ ...child, eyesight: "sharp" }, RACKET);
    const glasses = scoreChosenSports({ ...child, eyesight: "corrected" }, RACKET);
    expect(glasses.map((r) => r.score)).toEqual(sharp.map((r) => r.score));
  });

  it("still marks down vision that stays poor with glasses", () => {
    const glasses = scoreChosenSports({ ...child, eyesight: "corrected" }, RACKET);
    const limited = scoreChosenSports({ ...child, eyesight: "limited" }, RACKET);
    glasses.forEach((g, i) => expect(limited[i].score).toBeLessThan(g.score));
  });

  it("never says 'uncorrected' in a reason", () => {
    for (const fit of scoreChosenSports({ ...child, eyesight: "corrected" }, RACKET)) {
      expect(fit.strengths.join(" ")).not.toMatch(/uncorrected/i);
    }
  });
});
