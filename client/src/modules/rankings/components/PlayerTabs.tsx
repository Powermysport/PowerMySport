import Link from "next/link";

import type { HistoryRange } from "../utils/historyRange";

/**
 * The player page's sections as tabs. Each one is a link to `?tab=`, so the page
 * stays server-rendered, the back button works, and a section can be shared by
 * URL. It is navigation rather than a widget: `aria-current` marks the open one
 * and nothing needs client JavaScript.
 */

export const PLAYER_TABS = [
  { id: "progress", label: "Progress" },
  { id: "outlook", label: "What happens next" },
  { id: "points", label: "Where points come from" },
  { id: "rules", label: "Entry rules" },
] as const;

export type PlayerTabId = (typeof PLAYER_TABS)[number]["id"];

export function readPlayerTab(raw: string | undefined, available: PlayerTabId[]): PlayerTabId {
  const wanted = PLAYER_TABS.find((tab) => tab.id === raw)?.id;
  if (wanted && available.includes(wanted)) return wanted;
  return available[0] ?? "progress";
}

export function PlayerTabs({
  basePath,
  active,
  available,
  range,
  list,
}: {
  basePath: string;
  active: PlayerTabId;
  available: PlayerTabId[];
  /** The list in view when it is not the player's own age group, so a tab keeps it. */
  list?: string | null;
  /** Kept in the link so switching sections does not drop a chosen date range. */
  range: HistoryRange;
}) {
  const tabs = PLAYER_TABS.filter((tab) => available.includes(tab.id));
  if (tabs.length < 2) return null;

  const hrefFor = (id: PlayerTabId) => {
    const params = new URLSearchParams();
    if (list) params.set("list", list);
    if (id !== tabs[0]!.id) params.set("tab", id);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav
      aria-label="Sections of this player's page"
      className="border-border mt-10 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="-mb-px flex min-w-max gap-6 sm:gap-8">
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={hrefFor(tab.id)}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`focus-visible:ring-power-orange inline-flex min-h-11 items-center whitespace-nowrap border-b-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  current
                    ? "border-foreground text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent font-medium"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
