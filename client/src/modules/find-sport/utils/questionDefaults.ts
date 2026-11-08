import type { WizardAnswers } from "../types";

/** Starting height shown on the height screen: a rough average for the age, in cm. */
export const defaultHeightCm = (age: number | null): number =>
  age ? Math.round(Math.min(175, 85 + age * 5.5)) : 130;

/** Starting weight shown on the weight screen: a rough average for the age, in kg. */
export const defaultWeightKg = (age: number | null): number =>
  age ? Math.round(Math.min(80, 12 + age * 2.8)) : 35;

/**
 * The value a slider screen shows before the parent touches it. Continue must save exactly
 * what was on screen: it used to save nothing, so a parent who agreed with the shown height
 * left the profile without one (audit F2), and the "take the quiz" nudge then asked them to
 * take the quiz they had just finished.
 *
 * Returns the answer to record, or null when nothing needs recording (already answered, or
 * not a slider screen).
 */
export function displayedDefault(
  key: keyof WizardAnswers | "priorSports",
  answers: WizardAnswers
): { key: "height" | "weight"; value: number } | null {
  if (key === "height" && answers.height == null)
    return { key, value: defaultHeightCm(answers.age) };
  if (key === "weight" && answers.weight == null)
    return { key, value: defaultWeightKg(answers.age) };
  return null;
}
