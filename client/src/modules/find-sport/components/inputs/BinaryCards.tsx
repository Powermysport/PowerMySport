"use client";

import { optionClass, SelectMark } from "./optionStyles";

interface Option {
  value: string;
  title: string;
  sub: string;
}

export function BinaryCards({
  options,
  value,
  onChange,
}: {
  options: [Option, Option];
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
            className={`${optionClass(selected)} flex flex-col p-5`}
          >
            <SelectMark selected={selected} />
            <p className="text-ink mt-4 text-base font-semibold leading-snug">{opt.title}</p>
            <p className="text-ink-body mt-1.5 text-sm leading-relaxed">{opt.sub}</p>
          </button>
        );
      })}
    </div>
  );
}
