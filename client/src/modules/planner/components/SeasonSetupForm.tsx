"use client";

import {
  MAX_BLOCKED_RANGES,
  type BlockedRange,
  type PlanPreferences,
  type SeasonGoal,
} from "@/modules/planner/services/seasonPlan";
import { formatInr, parseRupees } from "@/modules/planner/utils/money";
import { Button } from "@/modules/shared/ui/Button";
import { Plus, X } from "lucide-react";
import { useState } from "react";

/**
 * The questions a season is built from: what it is for, where the family travels
 * from, the dates their child cannot play, and a budget. Everything the suggestions
 * are built around that the calendar cannot tell us.
 *
 * ── Why this comes BEFORE the suggestions ───────────────────────────────────
 * A parent pays for the convenience of not doing the work, so the planner asks a few
 * quick questions once and then does the rest. The suggestions used to sit behind a
 * "Suggest my season" button with this form folded away underneath, so a parent got
 * generic answers first and had to find the questions themselves. Now the form is the
 * first screen, its one button builds the season, and answers are changed later from a
 * one-line summary.
 *
 * ── Why a short list and not a free-text box ────────────────────────────────
 * The recommender serves exactly these three goals. A text box would promise
 * something it cannot do ("find me cheap events near my cousin") and would send
 * the parent's own words to a model for no benefit.
 *
 * ── Why the form is keyed by what is saved ──────────────────────────────────
 * The draft lives in a child that starts from the saved preferences. When a save
 * lands, the saved value changes, the key changes, and the form starts again from
 * it, with no effect copying props into state.
 */

const GOALS: Array<{ value: SeasonGoal; label: string; blurb: string }> = [
  {
    value: "points",
    label: "Climb the ranking",
    blurb: "Favours the higher rungs of the circuit.",
  },
  {
    value: "experience",
    label: "Match experience",
    blurb: "Favours entry-level events, where the draw is not cut by ranking.",
  },
  {
    value: "home",
    label: "Stay close to home",
    blurb: "Favours events in their own state.",
  },
];

const GOAL_LABEL: Record<SeasonGoal, string> = {
  points: "Climb the ranking",
  experience: "Match experience",
  home: "Stay close to home",
};

export const DEFAULT_PREFERENCES: PlanPreferences = {
  goal: "points",
  blockedRanges: [],
  budget: null,
  includeOlderGroup: false,
};

const INPUT =
  "min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange-solid";

/** A row is usable when both dates are set and the range does not run backwards. */
const rowProblem = (row: BlockedRange): string | null => {
  if (!row.from && !row.to) return null; // an empty row is simply dropped
  if (!row.from || !row.to) return "Choose both a start and an end date.";
  if (row.to < row.from) return "The end date is before the start date.";
  return null;
};

export function SeasonSetupForm({
  saved,
  homeState,
  savedCity,
  busy,
  submitLabel,
  busyLabel,
  onSubmit,
  footer,
}: {
  saved: PlanPreferences;
  homeState: string | null;
  /** The city on the parent's profile, if there is one. */
  savedCity: string | null;
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  /** `city` is null when it is blank or unchanged, so nothing is saved for it. */
  onSubmit: (preferences: PlanPreferences, city: string | null) => void;
  footer?: React.ReactNode;
}) {
  const [city, setCity] = useState<string>(savedCity ?? "");
  const [goal, setGoal] = useState<SeasonGoal>(saved.goal);
  const [rows, setRows] = useState<BlockedRange[]>(saved.blockedRanges);
  const [budgetText, setBudgetText] = useState<string>(
    saved.budget === null ? "" : String(saved.budget)
  );
  const [includeOlder, setIncludeOlder] = useState<boolean>(saved.includeOlderGroup);

  // Blank means no ceiling. Anything else must be a plain whole-rupee amount.
  const parsedBudget = parseRupees(budgetText);
  const budgetProblem =
    parsedBudget !== null && (Number.isNaN(parsedBudget) || parsedBudget > 10_000_000)
      ? "Enter the budget in whole rupees, for example 60000."
      : null;
  const budget = parsedBudget === null || budgetProblem ? null : parsedBudget;

  const problems = rows.map(rowProblem);
  const usable = rows.filter((row) => row.from && row.to);
  const cityText = city.trim();
  const cityProblem =
    cityText.length === 1 ? "Enter the name of your city, for example Pune." : null;
  // The button builds the season, so it is always available once the answers are valid:
  // asking again with nothing changed is free, and a parent who is happy with the defaults
  // should not have to alter something to move on.
  const canSave = !budgetProblem && !cityProblem && problems.every((problem) => problem === null);

  const update = (index: number, patch: Partial<BlockedRange>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave && !busy) {
          onSubmit(
            {
              goal,
              budget,
              includeOlderGroup: includeOlder,
              blockedRanges: usable.map(({ from, to, label }) => ({
                from,
                to,
                ...(label?.trim() ? { label: label.trim() } : {}),
              })),
            },
            cityText.length >= 2 && cityText !== (savedCity ?? "") ? cityText : null
          );
        }
      }}
      className="space-y-6"
    >
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12 lg:space-y-0">
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">
              What is this season for?
            </legend>
            <div className="mt-2 grid gap-2">
              {GOALS.map((option) => {
                const unavailable = option.value === "home" && !homeState;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${
                      goal === option.value
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } ${unavailable ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="season-goal"
                      value={option.value}
                      checked={goal === option.value}
                      disabled={unavailable}
                      onChange={() => setGoal(option.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                        {unavailable
                          ? "Their home state is not on the ranking list, so this is not available yet."
                          : option.value === "home" && homeState
                            ? `Favours events in ${homeState}.`
                            : option.blurb}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="flex cursor-pointer gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={includeOlder}
              onChange={(event) => setIncludeOlder(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-slate-900">
                Also show events in an older age group
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                They use the same yearly entries as their own age group, so they are only ever
                options, never picks.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-6">
          <div>
            <label htmlFor="season-city" className="text-sm font-semibold text-slate-900">
              Which city do you travel from?
            </label>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              So we can estimate travel and stay for each tournament. Saved to your profile; only
              the city is used, never an address.
            </p>
            <input
              id="season-city"
              type="text"
              value={city}
              maxLength={60}
              autoComplete="address-level2"
              placeholder="Pune"
              onChange={(event) => setCity(event.target.value)}
              className={`${INPUT} mt-2 w-full max-w-56`}
              aria-describedby={cityProblem ? "season-city-problem" : undefined}
            />
            {cityProblem && (
              <p id="season-city-problem" role="alert" className="mt-1 text-xs text-red-700">
                {cityProblem}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">Dates they cannot play</legend>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Exams, holidays or anything else. Events that run into these dates are left out of the
              suggestions.
            </p>

            {rows.length > 0 && (
              <ul className="mt-3 space-y-3">
                {rows.map((row, index) => (
                  <li key={index}>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        From
                        <input
                          type="date"
                          value={row.from}
                          onChange={(event) => update(index, { from: event.target.value })}
                          className={`${INPUT} mt-1 block`}
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-700">
                        To
                        <input
                          type="date"
                          value={row.to}
                          min={row.from || undefined}
                          onChange={(event) => update(index, { to: event.target.value })}
                          className={`${INPUT} mt-1 block`}
                        />
                      </label>
                      <label className="min-w-40 flex-1 text-xs font-semibold text-slate-700">
                        Note (optional)
                        <input
                          type="text"
                          value={row.label ?? ""}
                          maxLength={40}
                          placeholder="Board exams"
                          onChange={(event) => update(index, { label: event.target.value })}
                          className={`${INPUT} mt-1 block w-full`}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Remove these dates"
                        onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                        className="text-slate-500"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {problems[index] && (
                      <p role="alert" className="mt-1 text-xs text-red-700">
                        {problems[index]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {rows.length < MAX_BLOCKED_RANGES && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setRows((current) => [...current, { from: "", to: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Add dates
              </Button>
            )}
          </fieldset>

          <div>
            <label htmlFor="season-budget" className="text-sm font-semibold text-slate-900">
              Season budget (optional)
            </label>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              What you want the plan to stay within, for travel and stay. The planner shows the plan
              against it.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-600" aria-hidden>
                ₹
              </span>
              <input
                id="season-budget"
                type="text"
                inputMode="numeric"
                value={budgetText}
                placeholder="60000"
                onChange={(event) => setBudgetText(event.target.value)}
                className={`${INPUT} w-40`}
                aria-describedby={budgetProblem ? "season-budget-problem" : undefined}
              />
            </div>
            {budgetProblem && (
              <p id="season-budget-problem" role="alert" className="mt-1 text-xs text-red-700">
                {budgetProblem}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSave || busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}

/** One line saying what the season was built around, for the page that shows the result. */
export function setupSummary(saved: PlanPreferences, city: string | null): string {
  const blocked = saved.blockedRanges.length;
  return [
    GOAL_LABEL[saved.goal],
    city ? `from ${city}` : null,
    blocked > 0 ? `${blocked} set${blocked === 1 ? "" : "s"} of dates off` : null,
    saved.budget !== null ? `budget ${formatInr(saved.budget)}` : null,
    saved.includeOlderGroup ? "older age groups on" : null,
  ]
    .filter(Boolean)
    .join(", ");
}
