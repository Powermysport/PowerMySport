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
 * Everything a parent opens this page to learn, in one block.
 *
 * It used to be two stacked blocks (the answer card with three numbers, then a
 * pair of list cards that repeated the rank). They answer one question, so they
 * are one grid now: the big tile is the answer for the player's own age group,
 * two smaller tiles hold the numbers people compare (best rank, points to the
 * next rung), and a row underneath adds the state rank and any older list the
 * player also appears on.
 *
 * Tile size follows importance, not available space, and the tiles are plain
 * bordered cards like the rest of the site: no shadows, gradients or animated
 * counters. On a phone the grid is a single column in the same order.
 *
 * Everything below this block stays a normal top-to-bottom read.
 */

const tile = "bg-card border-border h-full rounded-xl border p-5";

export function PlayerSummary({
  standings,
  home,
  season,
  sportSlug,
  acronym,
}: {
  /** The player's current lists, own age group first. */
  standings: PlayerCurrentEntry[];
  home: string | null;
  season: SeasonSummary;
  sportSlug: string;
  acronym: string;
}) {
  const primary = standings[0];
  const others = standings.slice(1);

  if (!primary) return <NoCurrentStanding season={season} />;

  const extras: Array<{ key: string; node: ReactNode }> = [
    ...others.map((entry) => ({
      key: entry._id,
      node: <OtherListTile entry={entry} sportSlug={sportSlug} />,
    })),
    ...(primary.stateRank && primary.state
      ? [
          {
            key: "state",
            node: (
              <Stat
                label={`Within ${primary.state}`}
                value={`#${primary.stateRank}`}
                hint={
                  primary.insight.stateSize
                    ? `of ${primary.insight.stateSize.toLocaleString("en-IN")} ranked in the state`
                    : "in the state"
                }
              />
            ),
          },
        ]
      : []),
  ];
  const spans =
    extras.length === 1
      ? ["sm:col-span-6"]
      : extras.length === 2
        ? ["sm:col-span-4", "sm:col-span-2"]
        : extras.map(() => "sm:col-span-2");
  const nextTier = primary.insight.nextTier;
  const climb = season.bestClimb && season.bestClimb.places > 0 ? season.bestClimb : null;

  return (
    <section aria-labelledby="player-summary-heading">
      <h2 id="player-summary-heading" className="sr-only">
        Current standing
      </h2>

      <div className="grid gap-3 sm:grid-cols-6">
        <PrimaryTile
          entry={primary}
          sportSlug={sportSlug}
          acronym={acronym}
          showRole={others.length > 0 && home !== null}
          climb={climb}
        />

        {season.careerBest && (
          <Stat
            className="sm:col-span-2"
            label="Best rank so far"
            value={`#${season.careerBest.rank.toLocaleString("en-IN")}`}
            hint={`reached ${formatAsOn(season.careerBest.asOnDate)}`}
          />
        )}

        <Stat
          className="sm:col-span-2"
          label="Points"
          value={formatPoints(primary.totalPoints)}
          hint={
            nextTier
              ? `${formatPoints(nextTier.gap)} more for the ${tierPhrase(nextTier.rank)}`
              : "in their own age group"
          }
        />

        {/* The second row sits on the same six columns as the first, so its edges
            line up with the answer tile above: two tiles split 4 and 2, three
            split 2, 2 and 2. */}
        {extras.map((extra, index) => (
          <div key={extra.key} className={spans[index]}>
            {extra.node}
          </div>
        ))}
      </div>

      {others.length > 0 && home && (
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          {comboLabel({ category: primary.category, subcategory: home })} is the main list, the age
          group this player belongs to. Entering an older group as well is normal, and results there
          earn points on both lists.
        </p>
      )}
    </section>
  );
}

/** The answer: where they stand in their own age group, in the plainest words. */
function PrimaryTile({
  entry,
  sportSlug,
  acronym,
  showRole,
  climb,
}: {
  entry: PlayerCurrentEntry;
  sportSlug: string;
  acronym: string;
  showRole: boolean;
  climb: NonNullable<SeasonSummary["bestClimb"]> | null;
}) {
  const combo = { category: entry.category, subcategory: entry.subcategory };
  const listSize = entry.insight.listSize;
  const standing = nationalStandingPhrase(entry.rank, listSize);
  const gates = entryStatus(entry.rank, entry.subcategory);
  const base = comboHref(sportSlug, combo);
  // The page of the list this player sits on, so "who is around them" opens on
  // their neighbours, not on rank 1.
  const neighbours = `${base}${entry.rank > PAGE_SIZE ? `?page=${Math.ceil(entry.rank / PAGE_SIZE)}` : ""}`;

  return (
    <div className={`${tile} flex flex-col sm:col-span-4 sm:row-span-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={base}
            className="text-foreground hover:text-power-orange-solid focus-visible:ring-power-orange -my-2.5 inline-block py-2.5 text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {acronym} {comboLabel(combo)}
          </Link>
          {showRole && (
            <span className="text-muted-foreground mt-0.5 block text-xs">Own age group</span>
          )}
        </div>
        <RankDelta delta={entry.rankDelta} hasBaseline={entry.prevRank !== undefined} />
      </div>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
          #{entry.rank.toLocaleString("en-IN")}
        </span>
        {listSize && (
          <span className="text-muted-foreground text-base">
            of {listSize.toLocaleString("en-IN")}
          </span>
        )}
      </p>

      {/* Only the first letter moves: the phrase is authored lower-case so it can
          also sit mid-sentence elsewhere, and `capitalize` would title-case it. */}
      {standing && <p className="mt-2 text-lg font-medium first-letter:uppercase">{standing}</p>}
      {listSize && <FieldPosition rank={entry.rank} listSize={listSize} />}

      {climb && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <ArrowUp className="text-rank-delta-up h-4 w-4 shrink-0 self-center" aria-hidden />
          <span className="text-rank-delta-up font-bold tabular-nums">
            Up {climb.places.toLocaleString("en-IN")} places
          </span>
          <span className="text-muted-foreground">
            since we started tracking, from #{climb.from.toLocaleString("en-IN")}
          </span>
        </p>
      )}

      {/* One line of what this rank means for entries. The full rules, with their
          source, are in the panel further down: this is the pointer. */}
      {gates && gates.closed.length > 0 && (
        <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
          {`At this rank: ${gates.summary.toLowerCase()}.`}
        </p>
      )}

      <div className="border-border mt-auto flex flex-wrap items-center justify-between gap-x-4 border-t pt-3">
        <Link
          href={neighbours}
          className="text-foreground focus-visible:ring-power-orange -my-1 inline-flex items-center gap-1.5 py-3 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
        >
          See who is around #{entry.rank.toLocaleString("en-IN")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <span className="text-muted-foreground text-xs">as on {formatAsOn(entry.asOnDate)}</span>
      </div>
    </div>
  );
}

/** A list the player also appears on, usually one age group up. */
function OtherListTile({ entry, sportSlug }: { entry: PlayerCurrentEntry; sportSlug: string }) {
  const combo = { category: entry.category, subcategory: entry.subcategory };
  const listSize = entry.insight.listSize;
  const standing = nationalStandingPhrase(entry.rank, listSize);

  return (
    <div className={tile}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={comboHref(sportSlug, combo)}
            className="text-foreground hover:text-power-orange-solid focus-visible:ring-power-orange -my-2.5 inline-block py-2.5 text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {comboLabel(combo)}
          </Link>
          <span className="text-muted-foreground mt-0.5 block text-xs">Playing up</span>
        </div>
        <RankDelta delta={entry.rankDelta} hasBaseline={entry.prevRank !== undefined} />
      </div>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          #{entry.rank.toLocaleString("en-IN")}
        </span>
        {listSize && (
          <span className="text-muted-foreground text-sm">
            of {listSize.toLocaleString("en-IN")}
          </span>
        )}
      </p>
      {standing && <p className="mt-1 text-sm first-letter:uppercase">{standing}</p>}
      <p className="text-muted-foreground mt-1 text-sm tabular-nums">
        {formatPoints(entry.totalPoints)} points
      </p>
    </div>
  );
}

/** A labelled number, for the figures people compare. */
function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  hint: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${tile} ${className}`}>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1.5 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{hint}</p>
    </div>
  );
}

/** For a player we hold history for but no current list. */
function NoCurrentStanding({ season }: { season: SeasonSummary }) {
  return (
    <section aria-labelledby="player-summary-heading" className={tile}>
      <h2 id="player-summary-heading" className="text-base font-semibold">
        Not on a current list
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        We hold earlier weeks for this player, but they are not on the latest published list.
      </p>
      {season.careerBest && (
        <p className="mt-3 text-sm">
          Best rank so far{" "}
          <span className="font-bold tabular-nums">
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
    <div className="mt-3">
      <div aria-hidden className="bg-muted relative h-1.5 w-full rounded-full">
        <span
          className="border-card bg-power-orange absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm"
          style={{ left: `${position}%` }}
        />
      </div>
      <div aria-hidden className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>best</span>
        <span>{listSize.toLocaleString("en-IN")}th</span>
      </div>
    </div>
  );
}
