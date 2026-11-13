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
import { PlayerPointsPanel } from "@/modules/rankings/components/PlayerPointsPanel";
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
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { sport: sportSlug, regNo } = await params;
  const range = readHistoryRange(await searchParams);
  const sport = getRankingSport(sportSlug);
  if (!sport) notFound();
  if (!/^\d{4,8}$/.test(regNo)) notFound();

  const data = await fetchPlayer(regNo, sport.slug);
  if (!data) notFound();

  const { player, current, history } = data;
  // AITA ships names in block capitals; displayName cases them for reading.
  const name = displayName(player.fullName ?? `Player ${player.regNo}`);

  const season = summariseSeason(history, comboLabel);

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
  const primaryEntry = standings[0];
  const primaryCombo = primaryEntry && {
    category: primaryEntry.category,
    subcategory: primaryEntry.subcategory,
  };
  const primaryList = primaryCombo ? comboLabel(primaryCombo) : "";
  const primaryListHref = primaryCombo ? comboHref(sport.slug, primaryCombo) : "";

  // Chart the list the player has the most history in — usually their main age
  // group, and the one where a trend is actually readable.
  const byCombo = new Map<string, typeof history>();
  for (const point of history) {
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

  return (
    <>
      <PlayerPageHeader
        name={name}
        acronym={sport.federation.acronym}
        player={player}
        list={primaryEntry ? { label: primaryList, href: primaryListHref } : null}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <PlayerSummary
          standings={standings}
          home={home}
          season={season}
          sportSlug={sport.slug}
          acronym={sport.federation.acronym}
        />

        {charted.length > 0 && <RankProgress charted={charted} range={range} />}

        {/* Two cards side by side on a wide screen: where the trend is heading (what
          ageing results will cost if nothing replaces them) beside what the rank
          opens and closes under AITA's rules. The first answers the question the
          chart raises; the second is what a parent reaches for once they have
          decided something needs doing. Both are home bracket only: the 52-week
          cycle and the entry gates are per list, and a second copy for a bracket
          the child is only visiting would be a second, conflicting answer. */}
        {(outlook || rules) && (
          <div className={`mt-10 grid gap-6 ${outlook && rules ? "lg:grid-cols-2" : ""}`}>
            {outlook}
            {rules}
          </div>
        )}

        {primaryEntry && <PlayerPointsPanel entry={primaryEntry} name={name} />}

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
