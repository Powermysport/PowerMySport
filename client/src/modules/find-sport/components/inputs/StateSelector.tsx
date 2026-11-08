"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";
import { chipClass, fieldClass } from "./optionStyles";

export function StateSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (state: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? INDIAN_STATES_AND_UTS.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : INDIAN_STATES_AND_UTS;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="text-ink-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search your state..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your state"
          className={`${fieldClass} pl-9`}
        />
      </div>

      <div className="flex max-h-[calc(100vh-360px)] flex-wrap gap-2 overflow-y-auto pr-1">
        {filtered.map((s) => {
          const selected = value === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={selected}
              className={chipClass(selected)}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
