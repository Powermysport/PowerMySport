"use client";

// ─── "Not sure which sport?" on /roadmap ────────────────────────────────────
//
// The last card in the sport grid, for the parent who has not chosen yet. Every
// other card assumes a sport; this one hands them to the sport finder
// (/assessment/discover), which shortlists sports from a few questions about
// the child. It goes straight to the finder, past the /assessment choice page,
// because the card has already asked the question that page asks.
//
// Same shape as a SportCard, so the grid stays one grid: band, one sentence,
// footer. The band is plain cream with the question in it rather than a photo,
// so it reads as a different kind of card and never as a sixth sport.
//
// Shown only while the list is not narrowed: next to search results it would
// be noise, and an empty search already ends in its own route to help.

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

const EASE = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

export const SPORT_FINDER_HREF = "/assessment/discover";

export function SportFinderCard() {
  return (
    <article
      className={`ring-ink/10 group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 transition-[transform,box-shadow] ${EASE} hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(28,27,26,0.35)]`}
    >
      <Link
        href={SPORT_FINDER_HREF}
        className="focus-visible:ring-ink absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <span className="sr-only">Not sure which sport? Find a sport for your child</span>
      </Link>

      {/* ── Band ── */}
      <div className="bg-paper-deep pointer-events-none relative flex aspect-[3/2] flex-col justify-between p-6 sm:px-7">
        <p className="text-ink-muted text-sm font-medium">Sport finder</p>
        <h2 className="font-editorial text-ink text-balance text-[2rem] leading-[1.05] tracking-[-0.02em]">
          Not sure which <span className="italic">sport?</span>
        </h2>
      </div>

      {/* ── Summary ── */}
      <p className="text-ink-body min-h-[calc(4.875em+1rem)] px-6 pb-4 pt-5 text-[15px] leading-relaxed sm:px-7">
        Answer a few questions about your child&apos;s personality, build and goals, and get a
        shortlist of sports worth trying first.
      </p>

      {/* ── Footer ── */}
      <div className="border-hairline mx-6 mt-auto flex items-center justify-between gap-4 border-t py-4 sm:mx-7">
        <p className="text-ink-muted text-sm">About 5 minutes</p>
        <span
          aria-hidden
          className="text-ink inline-flex shrink-0 items-center gap-2 text-sm font-medium"
        >
          Find their sport
          <span
            className={`bg-ink grid size-8 place-items-center rounded-full text-white transition-transform ${EASE} group-hover:scale-105`}
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
