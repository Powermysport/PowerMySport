import type React from "react";
import { Brain, Heart, Target, User, Zap } from "lucide-react";
import { defineFlow } from "@/flow/defineFlow";
import type { WizardAnswers } from "../../types";

// ─── Date-of-birth bounds — mirrors the wizard's supported 4–18 age range ─────

export const DOB_BOUNDS = (() => {
  const today = new Date();
  const min = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const max = new Date(today.getFullYear() - 4, today.getMonth(), today.getDate());
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
})();

// ─── Step sequence definition ─────────────────────────────────────────────────

export type StepKind = "welcome" | "name" | "question" | "processing" | "results";

export type Step =
  | { kind: "welcome" }
  | { kind: "name" }
  | { kind: "question"; questionKey: keyof WizardAnswers | "priorSports" }
  | { kind: "processing" }
  | { kind: "results" };

/**
 * The questionnaire, one screen per entry (audit F4: 31 screens became 22).
 * - The name screen also asks boy or girl.
 * - `priorSports` shows "plays now" and "considering" together.
 * - `contactComfort` shows contact, water and indoor/outdoor as three short rows.
 * - The three "next section" interstitials are gone; the section label stays above each
 *   question.
 * - `focusStyle` also sets `repetitionTolerance`: one question, four answers (see
 *   PRACTICE_OPTIONS), at the user's request to merge the two.
 * `motorType` and `competitiveResponse` were never used by the scorer and are no longer
 * asked (F1); answers already stored on profiles stay.
 */
export const STEPS: Step[] = [
  { kind: "welcome" },
  { kind: "name" },
  { kind: "question", questionKey: "dob" },
  { kind: "question", questionKey: "state" },
  { kind: "question", questionKey: "priorSports" },
  { kind: "question", questionKey: "height" },
  { kind: "question", questionKey: "weight" },
  { kind: "question", questionKey: "energyType" },
  { kind: "question", questionKey: "visualTracking" },
  { kind: "question", questionKey: "eyesight" },
  { kind: "question", questionKey: "agility" },
  { kind: "question", questionKey: "teamIndividual" },
  { kind: "question", questionKey: "focusStyle" },
  { kind: "question", questionKey: "decisionStyle" },
  { kind: "question", questionKey: "pressureResponse" },
  { kind: "question", questionKey: "contactComfort" },
  { kind: "question", questionKey: "budget" },
  { kind: "question", questionKey: "ambition" },
  { kind: "question", questionKey: "weeklyHours" },
  { kind: "processing" },
  { kind: "results" },
];

export const QUESTION_STEPS = STEPS.filter((s) => s.kind === "question");
export const TOTAL_QUESTIONS = QUESTION_STEPS.length;

/**
 * How many things a parent answers, for the copy ("20 short questions"). Some screens
 * ask more than one: the name screen adds boy or girl, the sports screen adds the
 * shortlist, the comfort screen adds water and indoor/outdoor.
 */
export const QUESTIONS_ASKED = TOTAL_QUESTIONS + 1 + 1 + 2;

// The step lives in the URL. `processing` — the only step with a side-effect
// (it creates or updates the child profile) — is gated on the questionnaire
// being complete, i.e. the last question is answered. A bare `?step=processing`
// or `?step=results` therefore cannot fire that side-effect or render an empty
// report: it clamps back to the final question instead. Every other step is a
// question or a screen that is safe to open directly.
export const PROCESSING_INDEX = STEPS.findIndex((s) => s.kind === "processing");

/**
 * Below this age a parent can only guess at "repeats the same drill for months" and
 * "performs better with all eyes on them": the child has not trained yet. Those two are
 * skipped and score as neutral (audit F8).
 */
export const YOUNG_CHILD_AGE = 8;
export const YOUNG_CHILD_SKIPPED: ReadonlyArray<keyof WizardAnswers> = [
  "repetitionTolerance",
  "pressureResponse",
];
export const isYoungChild = (age: number | null): boolean => age !== null && age < YOUNG_CHILD_AGE;

export type AssessmentFlowContext = {
  completed: boolean;
  age: number | null;
  /** Not logged in: the welcome splash is skipped, the name screen opens the quiz. */
  guest: boolean;
  /** A saved child is selected whose date of birth, gender and state are known. */
  knownChild: boolean;
};
const stepNumberOf = (key: keyof WizardAnswers) =>
  String(STEPS.findIndex((s) => s.kind === "question" && s.questionKey === key) + 1);

export const ASSESSMENT_FLOW = defineFlow<string, AssessmentFlowContext>({
  id: "sport-assessment",
  steps: STEPS.map((_, i) => String(i + 1)),
  canEnter: {
    [String(PROCESSING_INDEX + 1)]: (ctx) => ctx.completed,
  },
  skipWhen: {
    // Guests arrive from the /assessment card, which already says what this is and how
    // long it takes. Logged-in parents keep it: it is where they pick the child.
    "1": (ctx: AssessmentFlowContext) => ctx.guest,
    // A returning child: the profile already holds these, so do not ask again.
    "2": (ctx: AssessmentFlowContext) => ctx.knownChild,
    [stepNumberOf("dob")]: (ctx: AssessmentFlowContext) => ctx.knownChild,
    [stepNumberOf("state")]: (ctx: AssessmentFlowContext) => ctx.knownChild,
    // Repetition has no screen of its own (it rides on the practice question, which shows
    // only its focus half to a young child), so pressure is the one step to skip.
    [stepNumberOf("pressureResponse")]: (ctx: AssessmentFlowContext) => isYoungChild(ctx.age),
  },
});

// ─── The practice question: focus and repetition in one ─────────────────────

/**
 * One question that answers two: how long the child can focus, and whether they can take
 * repeating the same thing. The four answers are the 2x2, so both stored answers stay
 * independent and the scorer still tells them apart. A child under YOUNG_CHILD_AGE is only
 * asked the focus half (repetition is a guess at that age, audit F8).
 */
export const PRACTICE_OPTIONS: ReadonlyArray<{
  value: string;
  focus: NonNullable<WizardAnswers["focusStyle"]>;
  repetition: NonNullable<WizardAnswers["repetitionTolerance"]>;
  label: string;
  context: string;
}> = [
  {
    value: "sustained-high",
    focus: "sustained",
    repetition: "high",
    label: "Stays with it for a long time, and happy to repeat it",
    context: "Can practise the same thing over and over without getting bored",
  },
  {
    value: "sustained-low",
    focus: "sustained",
    repetition: "low",
    label: "Stays with it for a long time, but needs variety",
    context: "Absorbed for ages, as long as it keeps changing",
  },
  {
    value: "bursts-high",
    focus: "bursts",
    repetition: "high",
    label: "Focuses in short bursts, but fine with repetition",
    context: "Needs breaks, then happily goes back to the same drill",
  },
  {
    value: "bursts-low",
    focus: "bursts",
    repetition: "low",
    label: "Focuses in short bursts, and needs variety",
    context: "20 to 30 minutes on one thing, and only if it keeps changing",
  },
];

/** The practice option matching the stored answers, if both are set. */
export const practiceValue = (a: WizardAnswers): string | null =>
  PRACTICE_OPTIONS.find((o) => o.focus === a.focusStyle && o.repetition === a.repetitionTolerance)
    ?.value ?? null;

// ─── Left sidebar metadata ────────────────────────────────────────────────────

export const SECTION_META: Record<string, { icon: React.ReactNode; title: string; desc: string }> =
  {
    Child: {
      icon: <User className="h-5 w-5" />,
      title: "About your child",
      desc: "Basic details that help us calibrate recommendations to their age, location, and background.",
    },
    Physical: {
      icon: <Zap className="h-5 w-5" />,
      title: "Physical profile",
      desc: "How they move, their energy pattern, and physical traits that align with different sports.",
    },
    Personality: {
      icon: <Brain className="h-5 w-5" />,
      title: "Mindset & competition",
      desc: "Decision-making style, focus pattern, and how they respond to pressure.",
    },
    Comfort: {
      icon: <Heart className="h-5 w-5" />,
      title: "Preferences & comfort",
      desc: "The environments they thrive in and activities they'd rather avoid.",
    },
    Practical: {
      icon: <Target className="h-5 w-5" />,
      title: "Goals & commitment",
      desc: "Your honest goals for this journey and realistic time and budget you can invest.",
    },
  };

export const SECTION_ORDER = ["Child", "Physical", "Personality", "Comfort", "Practical"];

export function getProfileChips(answers: WizardAnswers): { label: string; value: string }[] {
  const chips: { label: string; value: string }[] = [];
  if (answers.age) chips.push({ label: "Age", value: `${answers.age} yrs` });
  if (answers.gender && answers.gender !== "prefer-not")
    chips.push({ label: "Gender", value: answers.gender === "boy" ? "Boy" : "Girl" });
  if (answers.state) chips.push({ label: "State", value: answers.state });
  if (answers.energyType)
    chips.push({
      label: "Energy",
      value: answers.energyType === "explosive" ? "Explosive" : "Endurance",
    });
  if (answers.eyesight)
    chips.push({
      label: "Vision",
      value: { sharp: "Sharp", corrected: "Corrected", limited: "Limited" }[answers.eyesight]!,
    });
  if (answers.agility)
    chips.push({
      label: "Agility",
      value: { high: "High", moderate: "Moderate", low: "Low" }[answers.agility]!,
    });
  if (answers.teamIndividual !== null && answers.teamIndividual !== undefined) {
    const v = answers.teamIndividual;
    chips.push({
      label: "Style",
      value: v <= 2 ? "Solo player" : v >= 4 ? "Team player" : "Balanced",
    });
  }
  if (answers.pressureResponse)
    chips.push({
      label: "Pressure",
      value: { thrives: "Thrives", manages: "Manages", avoids: "Avoids" }[
        answers.pressureResponse
      ]!,
    });
  if (answers.environment)
    chips.push({
      label: "Environment",
      value: { outdoor: "Outdoors", indoor: "Indoors", "no-preference": "Either" }[
        answers.environment
      ]!,
    });
  if (answers.ambition)
    chips.push({
      label: "Goal",
      value: {
        fun: "Health & fun",
        competitive: "Competitive",
        national: "National",
        career: "Career in sport",
        professional: "Pro career",
      }[answers.ambition]!,
    });
  if (answers.budget)
    chips.push({
      label: "Budget",
      value: {
        "under-3k": "< ₹3k/mo",
        "3k-7k": "₹3–7k/mo",
        "7k-15k": "₹7–15k/mo",
        "15k-plus": "₹15k+/mo",
      }[answers.budget]!,
    });
  if (answers.weeklyHours)
    chips.push({ label: "Training", value: `${answers.weeklyHours} hrs/wk` });
  if (answers.consideringSports.length > 0)
    chips.push({ label: "Considering", value: answers.consideringSports.join(", ") });
  return chips;
}

// ─── Progress calculation (only question steps count) ─────────────────────────

export function questionProgress(stepIndex: number): number {
  const questionsAnsweredSoFar = STEPS.slice(0, stepIndex).filter(
    (s) => s.kind === "question"
  ).length;
  return Math.round((questionsAnsweredSoFar / TOTAL_QUESTIONS) * 100);
}
