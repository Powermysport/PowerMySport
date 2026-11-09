/**
 * The date range a player's rank history is narrowed to, read from the page's
 * `from` and `to` URL params (YYYY-MM-DD, both optional, both inclusive).
 *
 * Presets count back from the NEWEST WEEK WE HOLD, not from today: the mirror
 * can lag AITA by weeks, and "last 3 months" measured from today would quietly
 * show fewer lists than it promises.
 */

export interface HistoryRange {
  from: string | null;
  to: string | null;
}

export const RANGE_PRESETS = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const validIso = (value: string | undefined): string | null =>
  value && ISO.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;

/** Reads `from`/`to`, dropping malformed values and swapping a reversed pair. */
export function readHistoryRange(params: { from?: string; to?: string }): HistoryRange {
  const from = validIso(params.from);
  const to = validIso(params.to);
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

export const isRangeSet = (range: HistoryRange): boolean => Boolean(range.from || range.to);

/** Whether a list's as-on date (ISO string or timestamp) falls inside the range. */
export function inHistoryRange(asOnDate: string, range: HistoryRange): boolean {
  const day = asOnDate.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/** The `from` date for "the last N months", counted back from the newest week held. */
export function presetFrom(latestIso: string, months: number): string {
  const latest = new Date(`${latestIso.slice(0, 10)}T00:00:00Z`);
  const day = latest.getUTCDate();
  const target = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - months, 1));
  // Clamp to the month's last day, so 31 May minus 3 months is 28/29 Feb, not 3 Mar.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
