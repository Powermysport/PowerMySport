"use client";

import { optionClass } from "./optionStyles";

export function SpectrumSlider({
  value,
  onChange,
  leftLabel,
  rightLabel,
  leftExamples,
  rightExamples,
}: {
  value: number | null;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  leftExamples: string;
  rightExamples: string;
}) {
  const current = value ?? 3;

  const labels: Record<number, string> = {
    1: "Solo",
    2: "Mostly solo",
    3: "Balanced",
    4: "Mostly team",
    5: "Team",
  };

  return (
    <div className="space-y-5">
      <div className="text-ink flex justify-between text-sm font-medium">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((tick) => {
          const selected = current === tick;
          return (
            <button
              key={tick}
              type="button"
              onClick={() => onChange(tick)}
              aria-pressed={selected}
              aria-label={labels[tick]}
              className={`${optionClass(selected)} flex flex-col items-center gap-2 py-5`}
            >
              <span className="font-editorial text-ink text-2xl font-light tabular-nums">
                {tick}
              </span>
              <span className="text-ink-body text-center text-xs leading-tight">
                {labels[tick]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-ink-muted flex justify-between text-sm leading-snug">
        <span className="max-w-[140px]">{leftExamples}</span>
        <span className="max-w-[140px] text-right">{rightExamples}</span>
      </div>
    </div>
  );
}
