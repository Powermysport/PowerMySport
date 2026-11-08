"use client";

import { cn } from "@/utils/cn";
import { chipClass } from "./optionStyles";

type Option = { value: string; label: string };
export type ChoiceRow = {
  id: string;
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
};

/**
 * Several short single-choice questions on one screen, one row each. Used where three
 * separate screens each asked one small thing (audit F4: contact, water, indoor/outdoor).
 */
export function ChoiceRows({ rows }: { rows: ChoiceRow[] }) {
  return (
    <div className="divide-hairline border-hairline divide-y rounded-xl border bg-white">
      {rows.map((row) => (
        <div key={row.id} className="px-4 py-4">
          <p id={`${row.id}-label`} className="text-ink mb-2.5 text-base font-medium">
            {row.label}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${row.id}-label`}
            className="grid grid-cols-3 gap-2"
          >
            {row.options.map((opt) => {
              const selected = row.value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => row.onChange(opt.value)}
                  className={cn(chipClass(selected), "px-2 py-2.5")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
