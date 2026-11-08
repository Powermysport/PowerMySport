"use client";

import { chipClass } from "./optionStyles";

export function MultiSelectPills({
  options,
  selected,
  onChange,
  noneLabel = "None yet",
  max,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  noneLabel?: string;
  /** When set, caps how many options can be picked and shows a counter. */
  max?: number;
}) {
  const atLimit = max !== undefined && selected.length >= max;

  const toggle = (opt: string) => {
    if (opt === "__none__") {
      onChange([]);
      return;
    }
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
      return;
    }
    if (atLimit) return;
    onChange([...selected, opt]);
  };

  const noneSelected = selected.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex max-h-[calc(100vh-340px)] flex-wrap gap-2 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => toggle("__none__")}
          aria-pressed={noneSelected}
          className={chipClass(noneSelected)}
        >
          {noneLabel}
        </button>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          // Unselected pills go quiet once the cap is reached — the limit reads
          // as a rule of the question, not as a failed click.
          const locked = !isSelected && atLimit;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              disabled={locked}
              aria-pressed={isSelected}
              className={`${chipClass(isSelected)} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {max !== undefined && (
        <p className="text-ink-muted text-sm">
          {selected.length} of {max} selected
          {atLimit && ", deselect one to swap"}
        </p>
      )}
    </div>
  );
}
