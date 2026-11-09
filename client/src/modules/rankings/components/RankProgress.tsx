import type { PlayerHistoryPoint } from "../services/api";
import { formatAsOn } from "../services/api";
import { comboLabel } from "../config/rankings";
import { inHistoryRange, isRangeSet, type HistoryRange as Range } from "../utils/historyRange";
import { HistoryRange } from "./HistoryRange";
import { RankTrajectory } from "./RankTrajectory";

/**
 * "Progress week by week" on a player's page: up to two lists charted (the home
 * bracket first, then the one with most history), narrowed to the chosen range.
 *
 * The range applies to the charts only. The headline standing above them is
 * the player's current position and stays whole; narrowing it would make
 * "career high" mean "high in the last 3 months" without saying so.
 */
export function RankProgress({
  charted,
  range,
}: {
  /** `[category|subcategory, points]`, already in display order. */
  charted: Array<[string, PlayerHistoryPoint[]]>;
  range: Range;
}) {
  const allDays = charted.flatMap(([, points]) => points.map((p) => p.asOnDate.slice(0, 10)));
  if (allDays.length === 0) return null;
  const earliest = allDays.reduce((a, b) => (a < b ? a : b));
  const latest = allDays.reduce((a, b) => (a > b ? a : b));
  const narrowed = isRangeSet(range);

  const subtitle = narrowed
    ? `Lists from ${range.from ? formatAsOn(range.from) : "the first we hold"} to ${
        range.to ? formatAsOn(range.to) : "the latest"
      }.`
    : "Every list AITA has published since we started mirroring them.";

  return (
    <section className="mt-10">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Progress week by week</h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">{subtitle}</p>
      </div>

      <HistoryRange
        // Re-mounted on every range change so the custom From/To boxes show the
        // range in force after a preset is clicked, not what was last typed.
        key={`${range.from ?? ""}|${range.to ?? ""}`}
        earliest={earliest}
        latest={latest}
        from={range.from}
        to={range.to}
      />

      {charted.slice(0, 2).map(([key, all]) => {
        const [category, subcategory] = key.split("|");
        const label = comboLabel({ category: category ?? "", subcategory: subcategory ?? "" });
        if (all.length < 2) return null;
        const points = all.filter((p) => inHistoryRange(p.asOnDate, range));
        return (
          <div
            key={key}
            className="border-border bg-card mt-4 rounded-lg border p-4 shadow-sm sm:p-5"
          >
            <h3 className="text-sm font-semibold">{label}</h3>
            {points.length >= 2 ? (
              <RankTrajectory
                points={points.map((p) => ({
                  asOnDate: p.asOnDate,
                  rank: p.rank,
                  // Lets the hover readout answer the follow-up question: a jump
                  // of 80 places is a different story depending on whether the
                  // points moved with it.
                  totalPoints: p.totalPoints,
                }))}
                label={label}
              />
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                {points.length === 1
                  ? "Only one list in this range, so there is no trend to draw. Widen the range."
                  : "No lists in this range. Widen the range or choose All."}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
