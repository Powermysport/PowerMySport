"use client";

import { SeasonSetupForm } from "@/modules/planner/components/SeasonSetupForm";
import type { PlanPreferences } from "@/modules/planner/services/seasonPlan";
import { Sparkles } from "lucide-react";

/**
 * The first thing a parent sees for a child with no season yet: a handful of questions
 * and one button that builds the season from the answers.
 *
 * Nothing is suggested before they are answered. A list made without knowing the
 * child's goal, the family's travel or the dates off would be generic, and sorting
 * through it would be the parent's work. Here the parent answers once and we do the rest.
 *
 * The button saves the answers, then builds the suggestions, and the board swaps this
 * for the result when that lands. While it works the button says so and stays locked,
 * so a second tap cannot start a second build.
 */
export function SeasonIntake({
  childName,
  saved,
  homeState,
  savedCity,
  building,
  onBuild,
  onSkip,
  onCancel,
}: {
  childName: string;
  saved: PlanPreferences;
  homeState: string | null;
  savedCity: string | null;
  building: boolean;
  onBuild: (preferences: PlanPreferences, city: string | null) => void;
  /** First visit only: go to the tournaments without answering. */
  onSkip?: () => void;
  /** Coming back to change answers: leave them as they were. */
  onCancel?: () => void;
}) {
  return (
    <section
      aria-labelledby="intake-heading"
      data-tour="setup"
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-8"
    >
      <div className="max-w-2xl">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          <Sparkles className="h-4 w-4" aria-hidden />
          About a minute
        </p>
        <h2 id="intake-heading" className="font-editorial mt-2 text-2xl font-normal text-slate-900">
          Tell us about {childName}&apos;s season
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Answer a few questions and we will build the season: which tournaments to enter, in what
          order, and roughly what it will cost. Everything here is optional, and you can change it
          afterwards.
        </p>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <SeasonSetupForm
          saved={saved}
          homeState={homeState}
          savedCity={savedCity}
          busy={building}
          submitLabel={`Build ${childName}'s season`}
          busyLabel="Building the season..."
          onSubmit={onBuild}
          footer={
            building ? (
              <span role="status" className="text-xs text-slate-500">
                This can take a few seconds.
              </span>
            ) : onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
              >
                Keep my season as it is
              </button>
            ) : onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
              >
                Skip and browse tournaments
              </button>
            ) : null
          }
        />
      </div>
    </section>
  );
}
