"use client";

import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";
import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { parseTypedAge } from "@/modules/pathway/utils/childAge";
import { useId } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";

const MAX_AGE = 25;

const fieldClass =
  "focus-visible:border-ink focus-visible:ring-ink/20 border-hairline h-11 w-full rounded-md border bg-white px-3 text-base text-ink transition-colors hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2";

const labelClass = "text-ink mb-1.5 block text-sm font-medium";

/**
 * The four answers that let us mark which entries fit a child: sport, age,
 * boy or girl, state. They are kept in this browser only (see
 * useOpportunityProfile) and each one is optional; an entry is checked against
 * whatever was given.
 *
 * Sport and state are wide (long names), age and boy-or-girl are narrow, so on
 * a phone the two narrow ones share a row. Boy or girl is a two-button switch,
 * not a dropdown: one tap instead of two, and both answers are always visible.
 *
 * `sports` are the slugs worth offering. With none given, every sport we name.
 * `onSportChange` lets the list also act on the sport (it filters by it).
 */
export function ProfileFields({
  sports,
  className = "grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.25fr)]",
  sportValue,
  sportPlaceholder = "Choose a sport",
  onSportChange,
}: {
  sports: string[];
  /** The grid classes. The default is four across on a wide page. */
  className?: string;
  /** Overrides the remembered sport shown in the field (the list's URL filter). */
  sportValue?: string | undefined;
  sportPlaceholder?: string;
  onSportChange?: (sport: string | null) => void;
}) {
  const { profile, setField } = useOpportunityProfile();
  const ids = { age: useId(), sport: useId(), gender: useId(), state: useId() };
  const sportOptions = sports.length > 0 ? sports : Object.keys(SPORT_LABEL);
  const sport = sportValue ?? profile.sport ?? "";

  return (
    <div className={className}>
      <div className="col-span-2 lg:col-span-1">
        <label htmlFor={ids.sport} className={labelClass}>
          Sport
        </label>
        <select
          id={ids.sport}
          value={sport}
          onChange={(e) => {
            const next = e.target.value || null;
            setField("sport", next);
            onSportChange?.(next);
          }}
          className={fieldClass}
        >
          <option value="">{sportPlaceholder}</option>
          {sportOptions.map((slug) => (
            <option key={slug} value={slug}>
              {SPORT_LABEL[slug] ?? slug}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label htmlFor={ids.age} className={labelClass}>
          Child&apos;s age
        </label>
        <input
          id={ids.age}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_AGE}
          placeholder="e.g. 12"
          value={profile.age ?? ""}
          onChange={(e) => {
            const age = parseTypedAge(e.target.value);
            setField("age", age === null ? null : Math.min(MAX_AGE, age));
          }}
          className={`${fieldClass} tabular-nums`}
        />
      </div>

      <div className="min-w-0">
        <span id={ids.gender} className={labelClass}>
          Boy or girl
        </span>
        <div
          role="group"
          aria-labelledby={ids.gender}
          className="border-hairline grid h-11 grid-cols-2 gap-0.5 rounded-md border bg-white p-0.5"
        >
          {(["boy", "girl"] as const).map((value) => {
            const on = profile.gender === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                // A second tap takes the answer back, since "not said" has no button.
                onClick={() => setField("gender", on ? null : value)}
                className={`btn-motion focus-visible:ring-ink rounded-[4px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  on ? "bg-ink text-white" : "text-ink-body hover:bg-paper-deep"
                }`}
              >
                {value === "boy" ? "Boy" : "Girl"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="col-span-2 lg:col-span-1">
        <label htmlFor={ids.state} className={labelClass}>
          State
        </label>
        <select
          id={ids.state}
          value={profile.state ?? ""}
          onChange={(e) => setField("state", e.target.value || null)}
          className={fieldClass}
        >
          <option value="">Choose a state</option>
          {INDIAN_STATES_AND_UTS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
