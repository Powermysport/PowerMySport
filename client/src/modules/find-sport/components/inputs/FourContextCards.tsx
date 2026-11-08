"use client";

import { optionClass, SelectMark } from "./optionStyles";

interface Option {
  value: string;
  label: string;
  context: string;
}

export function FourContextCards({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`${optionClass(selected)} flex items-start gap-3 p-5`}
          >
            <span className="mt-0.5">
              <SelectMark selected={selected} />
            </span>
            <span>
              <span className="text-ink block text-base font-semibold leading-snug">
                {opt.label}
              </span>
              <span className="text-ink-body mt-1 block text-sm leading-relaxed">
                {opt.context}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
