import Link from "next/link";

import { comboLabel } from "../config/rankings";
import type { PlayerCurrentEntry } from "../services/api";
import type { HistoryRange } from "../utils/historyRange";

/**
 * Picks which of a player's lists the page describes.
 *
 * A child who plays up appears on two lists (their own age group and the one
 * above). The summary, the trend, what happens next, the points and the entry
 * rules are all per list, so showing both at once would give two answers to one
 * question. Instead the page shows one list at a time and this is the way to the
 * other: a link to `?list=`, so it works without JavaScript and can be shared.
 * Renders nothing for a player on a single list.
 */
export function PlayerListSwitch({
  basePath,
  standings,
  selected,
  home,
  tab,
  range,
  data,
}: {
  /** Dev stress-fixture name, carried so switching list stays on the fixture. */
  data?: string | undefined;
  basePath: string;
  /** Every list the player is on, own age group first. */
  standings: PlayerCurrentEntry[];
  selected: string;
  home: string | null;
  /** The open tab, carried across so switching list keeps the section in view. */
  tab: string | undefined;
  range: HistoryRange;
}) {
  if (standings.length < 2) return null;

  const hrefFor = (subcategory: string) => {
    const params = new URLSearchParams();
    if (data) params.set("data", data);
    if (subcategory !== standings[0]!.subcategory) params.set("list", subcategory);
    if (tab) params.set("tab", tab);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav aria-label="This player's ranking lists" className="mb-8">
      <ul className="flex flex-col gap-3 sm:flex-row">
        {standings.map((entry) => {
          const current = entry.subcategory === selected;
          const size = entry.insight.listSize;
          return (
            <li key={entry._id} className="sm:min-w-64">
              <Link
                href={hrefFor(entry.subcategory)}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`focus-visible:ring-power-orange block rounded-lg border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  current ? "border-foreground bg-card" : "border-border hover:border-foreground/40"
                }`}
              >
                <span className={`block text-sm ${current ? "font-semibold" : "font-medium"}`}>
                  {comboLabel({ category: entry.category, subcategory: entry.subcategory })}
                  <span className="text-muted-foreground font-normal">
                    {entry.subcategory === home ? ", own age group" : ", playing up"}
                  </span>
                </span>
                <span className="text-muted-foreground mt-0.5 block text-sm tabular-nums">
                  #{entry.rank.toLocaleString("en-IN")}
                  {size ? ` of ${size.toLocaleString("en-IN")}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
