import { comboLabel } from "../config/rankings";
import type { PlayerCurrentEntry, RankingBandProfile } from "../services/api";
import { PointsComposition } from "./PointsComposition";

/**
 * Their own point mix against the mix of the players above them. Reading the two
 * together is the actionable part: a player whose total is all singles, beside a
 * top ten that draws a quarter of its points from doubles and international
 * events, has been shown where the gap is.
 *
 * Home bracket only. Two of these panels, one per list, was four charts of
 * near-identical shape and no reader got to the end of them. Renders nothing when
 * the list has no aggregates to compare against.
 */
export function PlayerPointsPanel({ entry, name }: { entry: PlayerCurrentEntry; name: string }) {
  const band = playerBand(entry, name);
  if (!band) return null;

  const combo = { category: entry.category, subcategory: entry.subcategory };
  return (
    <div>
      <PointsComposition
        flat
        bands={[band, ...(entry.insight.bands ?? [])]}
        subcategory={entry.subcategory}
        title={`What makes up these points: ${comboLabel(combo)}`}
        caption={
          `The top bar is ${name}, broken into where each point came from. ` +
          "The bars under it are the averages for each part of the list. " +
          "Where a colour is wide at the top of the list but thin or missing " +
          "on the top bar, that is what the leading players are doing differently."
        }
      />
    </div>
  );
}

/**
 * The player's own points as a band, so their bar can sit beside the list's
 * averages in the same chart.
 *
 * Which columns are deductions is read off the API's aggregate bands rather than
 * re-derived here: the pipeline already made that call from the printed header,
 * and a second rule in the browser is a second chance to disagree with it.
 */
export function playerBand(entry: PlayerCurrentEntry, name: string): RankingBandProfile | null {
  const bands = entry.insight.bands ?? [];
  // No aggregates means no way to tell a deduction column from a scoring one, and
  // nothing to compare the player against. Both reasons to skip the panel.
  if (bands.length === 0) return null;
  const components = entry.points.slice(0, -1);
  if (components.length < 2) return null;

  const classified = new Map(
    bands.flatMap((band) =>
      (band.composition ?? []).map((slice) => [slice.label, slice.isDeduction] as const)
    )
  );

  return {
    // The child's own name, not "This player". The bar sits directly above three
    // rows labelled "Top 10", "Ranked 11–100" and "Ranked 101 and below", and a
    // parent scanning that stack should find the person they came for by name
    // rather than by working out which row must be theirs.
    label: name,
    from: entry.rank,
    to: entry.rank,
    playerCount: 1,
    averageTotal: entry.totalPoints,
    composition: components.map((point) => ({
      label: point.label,
      average: point.value,
      isDeduction: classified.get(point.label) ?? false,
    })),
  };
}
