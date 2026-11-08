"use client";

// ─── One sport on /roadmap ───────────────────────────────────────────────────
//
// A card says three things: which sport (the photo and the name), what its
// guide walks a parent through (one sentence), and the ages it covers. Opening
// the card is the only action. Stage-by-stage detail lives inside the guide,
// where it has room; on the index it read the same on every sport, because
// every sport is written to the same six-stage skeleton.
//
// ── Anatomy ──
//
//   band      the sport's photo (data/sportCards), 3:2, with the name over a
//             fade at its foot; plain cream with the name when there is no
//             photo yet, so the grid stays even
//   summary   one sentence on what the guide covers
//   footer    the ages it covers (or, once the child's age is known, the stage
//             the card opens at) and the "Read the guide" cue
//
// ── Interaction ──
//
// The whole card is the target and there is exactly one link, laid over the
// card under its content (`absolute inset-0`). The band ignores the pointer so
// clicks pass through to it. When the child's age is known, the link opens the
// guide at the stage that is about them rather than at stage one.

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cardContentFor } from "../data/sportCards";
import type { PathwayIndexEntry } from "../services/fetchGuide";
import { findStageForAge } from "../utils/ageRange";
import { ageSpan, shortStageName, stageHref } from "../utils/stageLabels";

/** One ease for every hover on the card: quick to start, a long soft landing. */
const EASE = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

export function SportCard({
  entry,
  age,
}: {
  entry: PathwayIndexEntry;
  /** The child's age, once a parent has given it inside a pathway. */
  age: number | null;
}) {
  const { stages, sportName, sportSlug } = entry;
  const { photo, summary } = cardContentFor(sportSlug);
  const matchIndex = age === null || stages.length === 0 ? -1 : findStageForAge(stages, age);
  const match = matchIndex >= 0 ? stages[matchIndex] : undefined;
  const span = ageSpan(stages);
  const count = entry.stageCount || stages.length;
  const text =
    summary ??
    `What each stage asks of a parent, from deciding whether to start to the road after school, in ${count} stages.`;

  return (
    <article
      className={`ring-ink/10 group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 transition-[transform,box-shadow] ${EASE} hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(28,27,26,0.35)]`}
    >
      {/* The card's one link, over the whole card, under its content. */}
      <Link
        href={stageHref(sportSlug, match?.key)}
        className="focus-visible:ring-ink absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <span className="sr-only">
          Read the {sportName} guide
          {match ? `, at stage ${matchIndex + 1}, ${match.name}` : ""}
        </span>
      </Link>

      {/* ── Band ── */}
      <div
        className={`pointer-events-none relative aspect-[3/2] overflow-hidden ${photo ? "bg-ink" : "bg-paper-deep"}`}
      >
        {photo && (
          <>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04] ${photo.position ?? "object-center"}`}
            />
            {/* Darkest under the name, clear over the top half. */}
            <div
              aria-hidden
              className="from-ink/80 via-ink/20 absolute inset-0 bg-gradient-to-t via-40% to-transparent"
            />
          </>
        )}
        <h2
          className={`font-editorial absolute bottom-0 left-0 p-6 text-[2rem] leading-none tracking-[-0.02em] sm:px-7 ${photo ? "text-white" : "text-ink"}`}
        >
          {sportName}
        </h2>
      </div>

      {/* ── Summary ──
          Three lines' room on every card, so footers line up across a row. */}
      <p className="text-ink-body min-h-[calc(4.875em+1rem)] px-6 pb-4 pt-5 text-[15px] leading-relaxed sm:px-7">
        {text}
      </p>

      {/* ── Footer ── */}
      <div className="border-hairline mx-6 mt-auto flex items-center justify-between gap-4 border-t py-4 sm:mx-7">
        <p className="text-ink-muted min-w-0 truncate text-sm tabular-nums">
          {match ? (
            <>
              Age {age}: <span className="text-ink">{shortStageName(match.name, sportName)}</span>
            </>
          ) : (
            (span ?? `${count} stages`)
          )}
        </p>
        <span
          aria-hidden
          className="text-ink inline-flex shrink-0 items-center gap-2 text-sm font-medium"
        >
          {/* The words only where the footer has room for them beside the
              ages; below that the arrow alone carries "open". */}
          <span className="hidden lg:inline">Read the guide</span>
          <span
            className={`bg-paper ring-ink/10 group-hover:bg-ink grid size-8 place-items-center rounded-full ring-1 transition-colors ${EASE} group-hover:text-white`}
          >
            <ArrowUpRight
              strokeWidth={1.5}
              className={`size-4 transition-transform ${EASE} group-hover:-translate-y-px group-hover:translate-x-px`}
            />
          </span>
        </span>
      </div>
    </article>
  );
}
