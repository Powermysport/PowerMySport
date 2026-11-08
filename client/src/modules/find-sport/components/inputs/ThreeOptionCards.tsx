"use client";

import { optionClass, SelectMark } from "./optionStyles";

interface Option {
  value: string;
  label: string;
}

export function ThreeOptionCards({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`${optionClass(selected)} flex items-center gap-4 px-4 py-4`}
          >
            <SelectMark selected={selected} />
            <p className="text-ink text-base leading-relaxed">{opt.label}</p>
          </button>
        );
      })}
    </div>
  );
}
