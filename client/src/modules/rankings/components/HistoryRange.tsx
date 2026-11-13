"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { RANGE_PRESETS, presetFrom } from "../utils/historyRange";

/**
 * Narrows a player's rank history to a date range: three preset spans counted
 * back from the newest week we hold, "All", or a custom From and To.
 *
 * Laid out as one tidy row: a segmented control for the quick choices, then the
 * custom range beside it. When a custom range is in force the control shows no
 * selection and the range group is outlined instead, with a link to clear it, so
 * it is always clear which one is active.
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
  const isCustom = !isAll && activePreset === undefined;

  // Apply only does something when the boxes differ from what is already showing.
  const changed = customFrom !== (from ?? "") || customTo !== (to ?? "");
  const canApply = changed && Boolean(customFrom || customTo);

  const segment = (active: boolean) =>
    `focus-visible:ring-ink h-8 rounded-[5px] px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 ${
      active ? "bg-ink text-white" : "text-ink-body hover:bg-paper-deep"
    }`;
  const dateClass =
    "border-hairline text-ink focus-visible:border-ink h-9 w-[9.5rem] rounded-md border bg-white px-2.5 text-sm outline-none transition";

  return (
    <div
      className="mt-4 flex flex-col gap-x-6 gap-y-3 lg:flex-row lg:flex-wrap lg:items-center"
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
    >
      <div
        role="group"
        aria-label="Show history for"
        className="border-hairline grid w-full grid-cols-4 gap-0.5 rounded-md border bg-white p-0.5 sm:inline-grid sm:w-auto"
      >
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.months}
            type="button"
            aria-pressed={activePreset === preset.months}
            onClick={() => go({ from: presetFrom(latest, preset.months), to: null })}
            className={segment(activePreset === preset.months)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isAll}
          onClick={() => go({ from: null, to: null })}
          className={segment(isAll)}
        >
          All
        </button>
      </div>

      <form
        aria-label="Custom date range"
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canApply) go({ from: customFrom || null, to: customTo || null });
        }}
      >
        <span className="text-ink-muted text-sm font-medium">Custom</span>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">From</span>
          <input
            type="date"
            value={customFrom}
            min={earliest}
            max={customTo || latest}
            onChange={(event) => setCustomFrom(event.target.value)}
            className={`${dateClass} ${isCustom ? "border-ink" : ""}`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">To</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || earliest}
            max={latest}
            onChange={(event) => setCustomTo(event.target.value)}
            className={`${dateClass} ${isCustom ? "border-ink" : ""}`}
          />
        </label>
        <button
          type="submit"
          disabled={!canApply}
          className="border-hairline text-ink hover:border-ink/40 h-9 rounded-md border bg-white px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
        {isCustom && (
          <button
            type="button"
            onClick={() => {
              setCustomFrom("");
              setCustomTo("");
              go({ from: null, to: null });
            }}
            className="text-ink text-sm font-medium underline underline-offset-4"
          >
            Clear range
          </button>
        )}
      </form>
    </div>
  );
}
