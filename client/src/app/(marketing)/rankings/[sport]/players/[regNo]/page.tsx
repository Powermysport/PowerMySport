import { NOINDEX_METADATA } from "@/lib/seo";
import { fetchPlayer } from "@/modules/rankings/services/api";
import { isJuniorBracket } from "@powermysport/shared-types";
import { EntryRules } from "@/modules/rankings/components/HowToRead";
import { RankProgress } from "@/modules/rankings/components/RankProgress";
import { readHistoryRange } from "@/modules/rankings/utils/historyRange";
import { playerPageTitle } from "@/modules/rankings/utils/playerTitle";
import { SeasonOutlook } from "@/modules/rankings/components/SeasonOutlook";
import { comboHref, comboLabel, getRankingSport } from "@/modules/rankings/config/rankings";
import { ownBracket } from "@/modules/rankings/utils/insights";
import {
  PlayerPageHeader,
  displayName,
  summariseSeason,
} from "@/modules/rankings/components/PlayerHero";
import { PlayerSummary } from "@/modules/rankings/components/PlayerSummary";
import { PlayerListSwitch } from "@/modules/rankings/components/PlayerListSwitch";
import { PlayerPointsPanel, playerBand } from "@/modules/rankings/components/PlayerPointsPanel";
import {
  PlayerTabs,
  readPlayerTab,
  type PlayerTabId,
} from "@/modules/rankings/components/PlayerTabs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * One player's standing and history.
 *
 * ── Why this page is noindex ─────────────────────────────────────────────────
 * Most people on these lists are children — the youngest are twelve — and the
 * page is keyed on a name plus a registration number. A searchable, crawlable
 * profile for a named minor is a materially different product from a ranking
 * table, and under the DPDP Act 2023 children's data carries obligations that
 * "AITA already published a PDF" does not discharge.
 *
 * So the page exists and is linked from the tables (a parent following their
 * own child's progress is the whole point), but it is kept out of search and
 * out of the sitemap until someone decides otherwise on purpose. Flipping it
 * on is one export away; flipping it back after Google has indexed a few
 * thousand children is not.
 *
 * No date of birth is shown anywhere — `birthYear` only, which the age
 * category already implies.
 *
 * ── How the page is ordered ──────────────────────────────────────────────────
 * By what a parent can do with it. The sentence that answers "is this good", then
 * the standing in their own age group, then the trend, then what the next level
 * costs and what this rank opens or closes, and only then the breakdown of where
 * the points came from. The old order led with a chart and buried the target.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string; regNo: string }>;
}): Promise<Metadata> {
  const { sport, regNo } = await params;
  return { ...NOINDEX_METADATA, title: await playerPageTitle(sport, regNo) };
}

export default async function PlayerRankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string; regNo: string }>;
  searchParams: Promise<{ from?: string; to?: string; tab?: string; list?: string }>;
}) {
  const { sport: sportSlug, regNo } = await params;
  const query = await searchParams;
  const range = readHistoryRange(query);
  const sport = getRankingSport(sportSlug);
  if (!sport) notFound();
  if (!/^\d{4,8}$/.test(regNo)) notFound();

  const data = await fetchPlayer(regNo, sport.slug);
  if (!data) notFound();

  const { player, current, history } = data;
  // AITA ships names in block capitals; displayName cases them for reading.
  const name = displayName(player.fullName ?? `Player ${player.regNo}`);

  // ── Which list is theirs ───────────────────────────────────────────────────
  // A child can enter an older bracket but never a younger one, so the youngest
  // bracket they appear on is their own age group and anything above it is
  // playing up. That ordering is what the whole page hangs on: the headline, the
  // chart and the entry rules all describe the home bracket, and a page that led
  // with the Under-18 row for an Under-16 player would be quietly wrong about
  // everything.
  const home = ownBracket(current.map((entry) => entry.subcategory));
  const standings = [...current].sort((a, b) => {
    if (a.subcategory === home) return -1;
    if (b.subcategory === home) return 1;
    return a.rank - b.rank;
  });
  // One list at a time: ?list= picks it, and an unknown value falls back to their
  // own age group. Everything below (summary, trend, outlook, points, rules) is
  // about this list only, so a player on two lists never gets two answers at once.
  const primaryEntry = standings.find((entry) => entry.subcategory === query.list) ?? standings[0];
  const listParam =
    primaryEntry && primaryEntry.subcategory !== standings[0]?.subcategory
      ? primaryEntry.subcategory
      : null;
  const season = summariseSeason(
    primaryEntry
      ? history.filter((point) => point.subcategory === primaryEntry.subcategory)
      : history,
    comboLabel
  );
  const primaryCombo = primaryEntry && {
    category: primaryEntry.category,
    subcategory: primaryEntry.subcategory,
  };
  const primaryList = primaryCombo ? comboLabel(primaryCombo) : "";
  const primaryListHref = primaryCombo ? comboHref(sport.slug, primaryCombo) : "";

  // Chart the list in view. With no current list at all, whatever history exists.
  const byCombo = new Map<string, typeof history>();
  for (const point of history) {
    if (primaryEntry && point.subcategory !== primaryEntry.subcategory) continue;
    const key = `${point.category}|${point.subcategory}`;
    const bucket = byCombo.get(key);
    if (bucket) bucket.push(point);
    else byCombo.set(key, [point]);
  }
  // The home bracket first, then whatever has the most weeks behind it.
  const charted = [...byCombo.entries()].sort((a, b) => {
    const aHome = a[0].endsWith(`|${home}`);
    const bHome = b[0].endsWith(`|${home}`);
    if (aHome !== bHome) return aHome ? -1 : 1;
    return b[1].length - a[1].length;
  });

  const primaryListLabel = primaryList;
  const outlook = primaryEntry?.projection ? (
    <SeasonOutlook
      projection={primaryEntry.projection}
      listLabel={primaryListLabel}
      playerName={name}
    />
  ) : null;
  const rules =
    primaryEntry && isJuniorBracket(primaryEntry.subcategory) ? (
      <EntryRules subcategory={primaryEntry.subcategory} listLabel={primaryListLabel} />
    ) : null;

  // Which sections have something to show; the tab bar offers only those.
  const available: PlayerTabId[] = [];
  if (charted.length > 0) available.push("progress");
  if (outlook) available.push("outlook");
  if (primaryEntry && playerBand(primaryEntry, name)) available.push("points");
  if (rules) available.push("rules");
  const tab = readPlayerTab(query.tab, available);

  return (
    <>
      <PlayerPageHeader
        name={name}
        acronym={sport.federation.acronym}
        player={player}
        list={primaryEntry ? { label: primaryList, href: primaryListHref } : null}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <PlayerListSwitch
          basePath={`/rankings/${sport.slug}/players/${regNo}`}
          standings={standings}
          selected={primaryEntry?.subcategory ?? ""}
          home={home}
          tab={query.tab}
          range={range}
        />

        <PlayerSummary
          standings={standings}
          selected={primaryEntry?.subcategory}
          home={home}
          season={season}
          sportSlug={sport.slug}
          acronym={sport.federation.acronym}
        />

        {/* One section at a time, chosen by ?tab=. The summary above is the page's
            answer; each tab is a follow-up question, and all four stacked made a page
            nobody read to the end. Every section describes the list chosen above, since
            the 52-week cycle and the entry gates are per list. */}
        <PlayerTabs
          basePath={`/rankings/${sport.slug}/players/${regNo}`}
          active={tab}
          available={available}
          range={range}
          list={listParam}
        />

        <div className="mt-8 min-h-64">
          {tab === "progress" && <RankProgress charted={charted} range={range} />}
          {tab === "outlook" && outlook}
          {tab === "points" && primaryEntry && (
            <PlayerPointsPanel entry={primaryEntry} name={name} />
          )}
          {tab === "rules" && rules}
        </div>

        {history.length === 0 && current.length === 0 && (
          <p className="text-muted-foreground mt-10 rounded-lg border border-dashed p-8 text-center">
            No ranking history held for this player.
          </p>
        )}

        <p className="text-muted-foreground mt-10 text-xs leading-relaxed">
          Rankings are published by the All India Tennis Association and mirrored here. PowerMySport
          is not affiliated with AITA.
        </p>
      </div>
    </>
  );
}
