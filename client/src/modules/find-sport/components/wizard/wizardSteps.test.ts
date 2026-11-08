import { describe, expect, it } from "vitest";
import { effectiveIndices, resolveStep } from "@/flow/defineFlow";
import { EMPTY_ANSWERS } from "../../types";
import {
  ASSESSMENT_FLOW,
  PRACTICE_OPTIONS,
  practiceValue,
  STEPS,
  type AssessmentFlowContext as Ctx,
  type Step,
} from "./wizardSteps";

const base: Ctx = { completed: false, age: 10, guest: false, knownChild: false };

const label = (s: Step) => (s.kind === "question" ? s.questionKey : s.kind);
const visible = (ctx: Ctx) => effectiveIndices(ASSESSMENT_FLOW, ctx).map((i) => label(STEPS[i]));

describe("assessment flow (audit F4 and F8)", () => {
  it("asks each thing once: no interstitials, merged screens, removed questions gone", () => {
    const all = STEPS.map(label);
    expect(all).not.toContain("transition");
    for (const gone of ["gender", "consideringSports", "environment", "waterComfort"]) {
      expect(all).not.toContain(gone); // asked inside the name, sports and comfort screens
    }
    expect(all).not.toContain("motorType");
    expect(all).not.toContain("competitiveResponse");
  });

  it("opens a guest's quiz on the name screen", () => {
    expect(resolveStep(ASSESSMENT_FLOW, null, { ...base, guest: true }).step).toBe("2");
    expect(visible({ ...base, guest: true })[0]).toBe("name");
  });

  it("keeps the welcome for a logged-in parent, where they pick the child", () => {
    expect(visible(base)[0]).toBe("welcome");
  });

  it("does not ask a returning child's name, date of birth or state again", () => {
    const shown = visible({ ...base, knownChild: true });
    expect(shown).not.toContain("name");
    expect(shown).not.toContain("dob");
    expect(shown).not.toContain("state");
    expect(shown[1]).toBe("priorSports");
  });

  it("skips the spotlight question under 8 only", () => {
    expect(visible({ ...base, age: 6 })).not.toContain("pressureResponse");
    expect(visible({ ...base, age: 8 })).toContain("pressureResponse");
    expect(visible({ ...base, age: null })).toContain("pressureResponse");
  });

  it("asks focus and repetition as one question", () => {
    const all = STEPS.map(label);
    expect(all).toContain("focusStyle");
    expect(all).not.toContain("repetitionTolerance");
  });
});

describe("the practice question (focus and repetition merged)", () => {
  it("covers every combination once, so both answers stay independent", () => {
    const combos = PRACTICE_OPTIONS.map((o) => `${o.focus}/${o.repetition}`);
    expect(new Set(combos)).toEqual(
      new Set(["sustained/high", "sustained/low", "bursts/high", "bursts/low"])
    );
  });

  it("shows the saved answers as the matching option, and nothing for half an answer", () => {
    expect(
      practiceValue({ ...EMPTY_ANSWERS, focusStyle: "bursts", repetitionTolerance: "high" })
    ).toBe("bursts-high");
    expect(practiceValue({ ...EMPTY_ANSWERS, focusStyle: "bursts" })).toBeNull();
  });
});
