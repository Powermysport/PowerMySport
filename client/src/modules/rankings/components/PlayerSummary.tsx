import { entryStatus } from "@powermysport/shared-types";
import { ArrowRight, ArrowUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PAGE_SIZE, comboHref, comboLabel } from "../config/rankings";
import type { PlayerCurrentEntry } from "../services/api";
import { formatAsOn, formatPoints, nationalStandingPhrase, tierPhrase } from "../utils/insights";
import type { SeasonSummary } from "./PlayerHero";
import { RankDelta } from "./RankDelta";

/**
 * Everything a parent opens this page to learn, in one band.
 *
 * The left side is the answer for the player's own age group, set as a sentence.
 * The right side is the figures people compare (best rank, points to the next
 * rung, state rank, any older list) as a ruled list. Structure is hairlines, not
 * boxes; on a phone it is one column in the same order.
 */

const link =
  "focus-visible:ring-power-orange rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const sentenceCase = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export function PlayerSummary({
  standings,
  selected,
  home,
  season,
  sportSlug,
  acronym,
}: {
  /** The player's current lists, own age group first. */
  standings: PlayerCurrentEntry[];
  /** The subcategory in view; the band describes this list only. */
  selected?: string | undefined;
  home: string | null;
  season: SeasonSummary;
  sportSlug: string;
  acronym: string;
}) {
  const primary = standings.find((entry) => entry.subcategory === selected) ?? standings[0];
  const others = standings.filter((entry) => entry !== primary);

  if (!primary) return <NoCurrentStanding season={season} />;

  const combo = { category: primary.category, subcategory: primary.subcategory };
  const listSize = primary.insight.listSize;
  const standing = nationalStandingPhrase(primary.rank, listSize);
  const nextTier = primary.insight.nextTier;
  const climb = season.bestClimb && season.bestClimb.places > 0 ? season.bestClimb : null;
  const gates = entryStatus(primary.rank, primary.subcategory);
  const base = comboHref(sportSlug, combo);
  // The page of the list this player sits on, so "who is around them" opens on
  // their neighbours, not on rank 1.
  const neighbours = `${base}${primary.rank > PAGE_SIZE ? `?page=${Math.ceil(primary.rank / PAGE_SIZE)}` : ""}`;
  const showRole = others.length > 0 && home !== null;

  return (
    <section
      aria-labelledby="player-summary-heading"
      className="border-border grid gap-x-16 gap-y-8 border-b pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <h2 id="player-summary-heading" className="sr-only">
        Current standing
      </h2>

      {/* The answer, as a sentence a parent can read aloud: the rank, the list it
          is in, then what that means. No tile and no label above it. */}
      <div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">
            #{primary.rank.toLocaleString("en-IN")}
          </span>
          {listSize && (
            <span className="text-muted-foreground text-lg tabular-nums">
              of {listSize.toLocaleString("en-IN")}
            </span>
          )}
          <RankDelta
            delta={primary.rankDelta}
            hasBaseline={primary.prevRank !== undefined}
            className="self-center text-sm"
          />
        </p>

        <p className="mt-3 text-lg leading-snug">
          in{" "}
          <Link href={base} className={`${link} font-medium`}>
            {acronym} {comboLabel(combo)}
          </Link>
          {showRole && (
            <span className="text-muted-foreground">
              {primary.subcategory === home ? ", their own age group" : ", playing up"}
            </span>
          )}
        </p>

        {standing && <p className="mt-1 text-lg font-medium">{sentenceCase(standing)}</p>}
        {listSize && <FieldPosition rank={primary.rank} listSize={listSize} />}

        {climb && (
          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <ArrowUp className="text-rank-delta-up h-4 w-4 shrink-0 self-center" aria-hidden />
            <span className="text-rank-delta-up font-semibold tabular-nums">
              Up {climb.places.toLocaleString("en-IN")} places
            </span>
            <span className="text-muted-foreground">
              since we started tracking, from #{climb.from.toLocaleString("en-IN")}
            </span>
          </p>
        )}

        {/* One line of what this rank means for entries. The full rules, with their
            source, are under the Entry rules tab. */}
        {gates && gates.closed.length > 0 && (
          <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
            {`At this rank: ${gates.summary.toLowerCase()}.`}
          </p>
        )}

        <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link
            href={neighbours}
            className={`${link} -my-2 inline-flex items-center gap-1.5 py-2 font-medium`}
          >
            See who is around #{primary.rank.toLocaleString("en-IN")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-muted-foreground text-xs">
            as on {formatAsOn(primary.asOnDate)}
          </span>
        </p>
      </div>

      {/* The figures people compare, set as a ruled list rather than a row of tiles:
          the eye reads down one edge instead of across four boxes. */}
      <dl className="divide-border border-border divide-y self-start border-t pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        {season.careerBest && (
          <Fact
            label="Best rank so far"
            value={`#${season.careerBest.rank.toLocaleString("en-IN")}`}
            hint={`reached ${formatAsOn(season.careerBest.asOnDate)}`}
          />
        )}
        <Fact
          label="Points"
          value={formatPoints(primary.totalPoints)}
          hint={
            nextTier
              ? `${formatPoints(nextTier.gap)} more for the ${tierPhrase(nextTier.rank)}`
              : "on this list"
          }
        />
        {primary.stateRank && primary.state && (
          <Fact
            label={`Within ${primary.state}`}
            value={`#${primary.stateRank}`}
            hint={
              primary.insight.stateSize
                ? `of ${primary.insight.stateSize.toLocaleString("en-IN")} ranked in the state`
                : "in the state"
            }
          />
        )}
      </dl>

      {others.length > 0 && home && (
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed lg:col-span-2">
          {comboLabel({ category: primary.category, subcategory: home })} is the main list, the age
          group this player belongs to. Entering an older group as well is normal, and results there
          earn points on both lists.
        </p>
      )}
    </section>
  );
}

/** A labelled figure on the ruled list: label and hint left, the number right. */
function Fact({ label, value, hint }: { label: string; value: string; hint: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <dt className="text-sm font-medium">{label}</dt>
        <dd className="text-muted-foreground mt-0.5 text-sm">{hint}</dd>
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

/** For a player we hold history for but no current list. */
function NoCurrentStanding({ season }: { season: SeasonSummary }) {
  return (
    <section aria-labelledby="player-summary-heading" className="border-border border-b pb-10">
      <h2 id="player-summary-heading" className="text-xl font-semibold">
        Not on a current list
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        We hold earlier weeks for this player, but they are not on the latest published list.
      </p>
      {season.careerBest && (
        <p className="mt-3 text-sm">
          Best rank so far{" "}
          <span className="font-semibold tabular-nums">
            #{season.careerBest.rank.toLocaleString("en-IN")}
          </span>
          , reached {formatAsOn(season.careerBest.asOnDate)}.
        </p>
      )}
    </section>
  );
}

/**
 * Where the player sits in the field, drawn rather than only stated.
 *
 * It draws the field and labels both ends, with a marker where the player
 * stands, instead of a bar filled to a percentile: a fuller bar reads as better,
 * which would have given the best players the emptiest bars.
 */
function FieldPosition({ rank, listSize }: { rank: number; listSize: number }) {
  const position = Math.min(100, Math.max(0, (rank / listSize) * 100));
  return (
    <div className="mt-4 max-w-md">
      <div aria-hidden className="bg-border relative h-px w-full">
        <span
          className="border-background bg-power-orange-solid absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${position}%` }}
        />
      </div>
      <div aria-hidden className="text-muted-foreground mt-2 flex justify-between text-xs">
        <span>best</span>
        <span>{listSize.toLocaleString("en-IN")}th</span>
      </div>
    </div>
  );
}
