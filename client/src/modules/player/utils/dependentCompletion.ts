import { primarySport } from "@powermysport/shared-types";
// ─── Dependent Profile Completion Scoring ───────────────────────────────────
//
// "Complete" means the profile has what the planner, tournaments and booking
// actually read about a child: a sport, where they are, what they can commit to,
// and how far along they are. It deliberately does NOT count the sport-matching
// quiz's answers (physical, personality, comfort). Those belong to the quiz and
// are filled by taking it, so a parent who never takes the quiz can still reach
// 100%.
//
// Client-side only. The profile response carries the fields; nothing here is
// stored.

export interface DependentCompletionProfile {
  sportsFocus?: string[];
  chosenSport?: string;
  location?: string;
  budgetRange?: string;
  ambition?: string;
  weeklyHoursCategory?: string;
  experienceLevel?: string;
  currentStandingTier?: number;
  wizardCompletedAt?: string;
  // The quiz's own answers, read only by `isMissingArchetypeTraits`.
  quiz?: {
    heightCm?: number;
    weightKg?: number;
    energyType?: string;
    teamIndividual?: number;
    focusStyle?: string;
    decisionStyle?: string;
    contactComfort?: string;
    environment?: string;
    waterComfort?: string;
  } | null;
}

export const DEPENDENT_COMPLETION_FIELDS: Array<{
  field: string;
  label: string;
  weight: number;
  isFilled: (p: DependentCompletionProfile) => boolean;
}> = [
  {
    field: "sportsFocus",
    label: "Sports interest",
    weight: 20,
    // A child has one sport; `primarySport` is the single place that decides it, so the
    // dashboard, the edit form and this score can never disagree about whether it is set.
    isFilled: (p) => primarySport(p) !== null,
  },
  {
    field: "location",
    label: "Location",
    weight: 20,
    isFilled: (p) => !!p.location,
  },
  {
    field: "practical",
    label: "Goal, budget and time",
    weight: 30,
    isFilled: (p) => !!p.budgetRange && !!p.ambition && !!p.weeklyHoursCategory,
  },
  {
    field: "standing",
    label: "Current level",
    weight: 30,
    // Either the level the parent picked in the edit form or the standing tier
    // from the "I know my sport" flow. Neither needs the quiz.
    isFilled: (p) => !!p.experienceLevel || !!p.currentStandingTier,
  },
];

export interface DependentCompletionResult {
  percent: number;
  missing: Array<{ field: string; label: string; weight: number }>;
}

export function calculateDependentCompletion(
  profile: DependentCompletionProfile | null | undefined
): DependentCompletionResult {
  const safeProfile = profile ?? {};
  const totalWeight = DEPENDENT_COMPLETION_FIELDS.reduce((sum, f) => sum + f.weight, 0);

  let filledWeight = 0;
  const missing: DependentCompletionResult["missing"] = [];

  for (const f of DEPENDENT_COMPLETION_FIELDS) {
    if (f.isFilled(safeProfile)) {
      filledWeight += f.weight;
    } else {
      missing.push({ field: f.field, label: f.label, weight: f.weight });
    }
  }

  return {
    percent: totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 100,
    missing,
  };
}

/** True once the Discover quiz has been taken, or a current-standing tier recorded:
 * "we know where this child stands". Drives the "Assessed" tick, not the score. */
export function hasAssessment(profile: DependentCompletionProfile | null | undefined): boolean {
  return !!profile?.wizardCompletedAt || !!profile?.currentStandingTier;
}

/** True when this child has never been through the Discover quiz and its physical,
 * personality and comfort answers are not all there (from the edit modal either).
 * Gates the cross-flow nudges that offer to add them (guidance, expert booking).
 *
 * A finished quiz counts on its own: the quiz may leave some answers blank on purpose
 * (questions skipped by age, or removed later), and judging it answer by answer asked
 * parents to take the quiz they had just finished (audit F15). */
export function isMissingArchetypeTraits(
  profile: DependentCompletionProfile | null | undefined
): boolean {
  if (profile?.wizardCompletedAt) return false;
  const q = profile?.quiz ?? {};
  const physical = !!q.heightCm && !!q.weightKg && !!q.energyType;
  const personality = q.teamIndividual !== undefined && !!q.focusStyle && !!q.decisionStyle;
  const comfort = !!q.contactComfort && !!q.environment && !!q.waterComfort;
  return !(physical && personality && comfort);
}
