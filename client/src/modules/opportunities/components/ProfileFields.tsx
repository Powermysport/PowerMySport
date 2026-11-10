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

// ─── The answers about the child, one field each ─────────────────────────
//
// Kept in this browser only (see useOpportunityProfile), each one optional.
// They are separate so a page can put each question where it is needed: the
// list puts all four in one panel (ProfileFields), an entry's page puts each
// one inside the rule it checks.

interface FieldProps {
  /** The visible label. */
  label?: string;
  className?: string | undefined;
}

/** `sports` are the slugs worth offering. With none given, every sport we name. */
export function SportField({
  sports,
  label = "Sport",
  className,
  value,
  placeholder = "Choose a sport",
  onChange,
}: FieldProps & {
  sports: string[];
  /** Overrides the remembered sport shown in the field (the list's URL filter). */
  value?: string | undefined;
  placeholder?: string | undefined;
  onChange?: ((sport: string | null) => void) | undefined;
}) {
  const { profile, setField } = useOpportunityProfile();
  const id = useId();
  const options = sports.length > 0 ? sports : Object.keys(SPORT_LABEL);
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? profile.sport ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          setField("sport", next);
          onChange?.(next);
        }}
        className={fieldClass}
      >
        <option value="">{placeholder}</option>
        {options.map((slug) => (
          <option key={slug} value={slug}>
            {SPORT_LABEL[slug] ?? slug}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AgeField({ label = "Child's age", className }: FieldProps) {
  const { profile, setField } = useOpportunityProfile();
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
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
  );
}

/**
 * A two-button switch, not a dropdown: one tap instead of two, and both answers
 * always visible. A second tap takes the answer back, since "not said" has no button.
 */
export function GenderField({ label = "Boy or girl", className }: FieldProps) {
  const { profile, setField } = useOpportunityProfile();
  const id = useId();
  return (
    <div className={className}>
      <span id={id} className={labelClass}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className="border-hairline grid h-11 grid-cols-2 gap-0.5 rounded-md border bg-white p-0.5"
      >
        {(["boy", "girl"] as const).map((value) => {
          const on = profile.gender === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
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
  );
}

export function StateField({ label = "State", className }: FieldProps) {
  const { profile, setField } = useOpportunityProfile();
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
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
  );
}

/**
 * All four answers together, for the list's filter panel. Sport and state are
 * wide (long names), age and boy-or-girl are narrow, so on a phone the two
 * narrow ones share a row.
 */
export function ProfileFields({
  sports,
  className = "grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.25fr)]",
  sportValue,
  sportPlaceholder,
  onSportChange,
}: {
  sports: string[];
  /** The grid classes. The default is four across on a wide page. */
  className?: string;
  sportValue?: string | undefined;
  sportPlaceholder?: string | undefined;
  onSportChange?: ((sport: string | null) => void) | undefined;
}) {
  return (
    <div className={className}>
      <SportField
        sports={sports}
        className="col-span-2 lg:col-span-1"
        value={sportValue}
        placeholder={sportPlaceholder}
        onChange={onSportChange}
      />
      <AgeField className="min-w-0" />
      <GenderField className="min-w-0" />
      <StateField className="col-span-2 lg:col-span-1" />
    </div>
  );
}
