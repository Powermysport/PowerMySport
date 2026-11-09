"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { RANGE_PRESETS, presetFrom } from "../utils/historyRange";

/**
 * Narrows a player's rank history to a date range: three preset spans counted
 * back from the newest week we hold, "All", or a custom From and To.
 *
 * Lives in the URL (`from`, `to`) like the list filters, so a narrowed view can
 * be shared and survives a refresh. Changing it keeps the scroll position: the
 * reader is looking at the chart, not the top of the page.
 */
export function HistoryRange({
  earliest,
  latest,
  from,
  to,
}: {
  /** Oldest and newest weeks this player has on record (YYYY-MM-DD). */
  earliest: string;
  latest: string;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  const go = (next: { from?: string | null; to?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    startTransition(() =>
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    );
  };

  const activePreset = !to
    ? RANGE_PRESETS.find((preset) => presetFrom(latest, preset.months) === from)?.months
    : undefined;
  const isAll = !from && !to;

  const chip = (active: boolean) =>
    `inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2 ${
      active
        ? "border-foreground bg-foreground text-background"
        : "bg-background hover:border-power-orange"
    }`;
  const dateClass =
    "bg-background focus-visible:ring-power-orange h-9 rounded-md border px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  return (
    <div className="mt-4 space-y-3" data-pending={isPending ? "" : undefined}>
      <div role="group" aria-label="Show history for" className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.months}
            type="button"
            aria-pressed={activePreset === preset.months}
            onClick={() => go({ from: presetFrom(latest, preset.months), to: null })}
            className={chip(activePreset === preset.months)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isAll}
          onClick={() => go({ from: null, to: null })}
          className={chip(isAll)}
        >
          All
        </button>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          go({ from: customFrom || null, to: customTo || null });
        }}
      >
        <div>
          <label
            htmlFor="history-from"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            From
          </label>
          <input
            id="history-from"
            type="date"
            value={customFrom}
            min={earliest}
            max={customTo || latest}
            onChange={(event) => setCustomFrom(event.target.value)}
            className={dateClass}
          />
        </div>
        <div>
          <label
            htmlFor="history-to"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            To
          </label>
          <input
            id="history-to"
            type="date"
            value={customTo}
            min={customFrom || earliest}
            max={latest}
            onChange={(event) => setCustomTo(event.target.value)}
            className={dateClass}
          />
        </div>
        <button type="submit" className={chip(false)}>
          Apply
        </button>
      </form>
    </div>
  );
}
