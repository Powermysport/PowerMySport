"use client";

// ─── The sport picker ────────────────────────────────────────────────────────
//
// The one thing `/roadmap` exists to do: get a parent out of the index and into
// the part of a pathway that is about their child.
//
// ── Why it is more than a list of links ──
//
// It was a list of links. Each one opened its sport at stage one, which is the
// right stage for a parent who has not started and the wrong stage for everyone
// else — the eleven-year-old's parent landed four stages early and had to work
// out, from a rail of unfamiliar names, where they actually belonged. That work
// happens at the exact moment a visitor is cheapest to lose.
//
// So when the child's age is known, each tile points at the stage that is about
// them rather than at stage one.
//
// It is OFFERED here, never required. There was once an age field at the top of
// this page, and it was the wrong shape: a form field is a toll gate on the one
// screen whose entire job is "pick a sport". It is now a row of age chips
// (`AgeChips`) under the search: one optional tap, skippable at a glance. The
// reader also asks, inside a guide, and either answer is remembered, so a
// parent who answered there arrives here with the chips already set.
//
// ── Why it is built for fifty sports, not ten ──
//
// Ten pathways are published; the plan is many more. Every decision below is
// what it is because the same component has to work at fifty:
//
//   · NEVER show the catalogue as cards. This is the load-bearing one. A tile is
//     a rich object — a name, a stage count, the child's own stage, a control
//     that opens the rest — and fifty of those is not a picker, it is a car
//     park. Compacting the card does not fix it; fifty of anything laid out in a
//     grid is a wall. So the default view is `BROWSE_TILES` sports in curated
//     order, a search result is capped at `RESULT_TILES`, and the complete list
//     lives at the foot as an alphabetical index of plain links — dense,
//     skimmable, and the right shape for a directory. Rich cards are for the few
//     sports a parent is choosing between; a directory is for the rest.
//
//   · FIND, don't scan. The primary interaction is not "look down the list", it
//     is "type the name". Search is therefore the first and largest control —
//     and it renders at two sports as readily as at fifty, because the box is
//     also how a visitor learns that this page is a catalogue rather than the
//     short list it currently looks like. It matches aliases, so "ping pong" and
//     "soccer" find the sport they mean, and Enter opens the top match at the
//     child's stage without touching the list at all.
//
//   · GROUP the rest. A flat fifty is a wall. The group filter appears only once
//     there are enough sports to need it (`GROUP_FILTER_FROM`), so today's page
//     is not cluttered by a control that answers a question nobody has yet.
//
//   · ONE action per card. A card (`SportCard`) is the sport's photo, one
//     sentence on what its guide covers, and the ages. Stage detail lives in
//     the guide; once the child's age is known, the card opens it at their stage.
//
//   · NO reordering by age. It was sorted so age-matched sports came first,
//     which reads well at three sports and does nothing at fifty — nearly every
//     sport has a stage covering a twelve-year-old, so the sort churns the grid
//     and separates nothing. Curated order is stable and learnable instead.
//
//   · NO layout animation. Animating fifty tiles into new positions on every
//     keystroke is the kind of motion that makes a fast filter feel slow.
//
// Everything renders on the server too. Search and filtering start empty, and
// the A–Z index is a real <details> rather than a JavaScript toggle, so the HTML
// a crawler reads still contains every published sport as a real link — capping
// the TILES does not cap the LINKS.

import { ChevronDown, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useId, useMemo, useState } from "react";

import { findStageForAge } from "../utils/ageRange";
import { useChildAge } from "../utils/childAge";
import type { PathwayIndexEntry } from "../services/fetchGuide";
import { filterSports, groupCounts, indexSports } from "../utils/pickerFilter";
import type { SportGroup } from "../data/sports";
import { stageHref } from "../utils/stageLabels";
import { AgeChips } from "./AgeChips";
import { SportCard } from "./SportCard";
import { SportFinderCard } from "./SportFinderCard";

/** Below this many sports, the group filter is noise. */
const GROUP_FILTER_FROM = 12;

/**
 * Where the search bar starts sticking to the top while the list scrolls.
 *
 * Not a threshold for the search box itself. Search used to be hidden below this count,
 * on the reasoning that two sports do not need finding — which is true and beside
 * the point: the box is how a visitor learns this page is a catalogue rather than
 * the two-sport list it currently looks like. It renders always.
 */
const DENSE_FROM = 8;

/**
 * How many sports are shown as tiles before the parent has narrowed anything.
 *
 * The number that matters most in this file. A tile is a rich object — a name, a
 * stage count, the child's own stage, a control that opens the rest — and fifty
 * of them is not a picker, it is a car park. So the default view is a handful in
 * curated order and the catalogue lives behind search, a group, or the A–Z index
 * at the foot. Eight fills two rows on a laptop and four on a phone.
 */
const BROWSE_TILES = 8;

/**
 * The cap on a search or group result.
 *
 * Typing one letter can match thirty sports, and thirty tiles is the same car
 * park arrived at from a different direction. Past this the page says how many
 * more there are and asks for another letter, which is cheaper for the parent
 * than a scroll.
 */
const RESULT_TILES = 12;

// ─── The picker ──────────────────────────────────────────────────────────────

export function PathwayPicker({ entries }: { entries: PathwayIndexEntry[] }) {
  // `null` on the server and on the first client render, then whatever the
  // parent last told us. Writing it is what the reader reads, so an age typed
  // here also marks "you are here" on every pathway opened afterwards.
  const age = useChildAge();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<SportGroup | "All">("All");
  // Cards stagger in on the first paint only. Cleared shortly after, so a card
  // that appears later because of a search lands without moving: animating the
  // list on every keystroke makes a fast filter feel slow.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const searchId = useId();
  const router = useRouter();

  const dense = entries.length >= DENSE_FROM;

  // Ordering, grouping and matching all live in `pickerFilter` — pure functions
  // the tests can run over fifty synthetic sports, which is the scale this page
  // is built for and cannot yet be seen at.
  const sports = useMemo(() => indexSports(entries), [entries]);
  const groups = useMemo(() => groupCounts(sports), [sports]);

  // ── A filter that cannot divide the list does not belong on the page ──
  //
  // Groups come from a hand-maintained registry, and sports get published faster
  // than anyone classifies them. Left alone, that produces a filter row reading
  // "All 54 · Other 44 · Team 5 · Racquet 3" — four controls where one of them
  // is the list again. So the row only renders when the largest group is a real
  // minority of the catalogue; until the registry catches up, search and the A–Z
  // index carry the page on their own.
  const largestGroup = groups[0]?.[1] ?? 0;
  const showGroups =
    entries.length >= GROUP_FILTER_FROM &&
    groups.length >= 3 &&
    largestGroup / entries.length < 0.6;
  const visible = useMemo(() => filterSports(sports, { group, query }), [sports, group, query]);

  const needle = query.trim().toLowerCase();

  if (entries.length === 0) {
    return (
      <p className="text-ink-body mx-auto mt-4 max-w-xl text-center text-sm sm:text-base">
        No pathways are published yet. We&apos;re building them with coaches and experienced
        parents, one sport at a time. Check back shortly.
      </p>
    );
  }

  const narrowed = needle.length > 0 || group !== "All";
  const cap = narrowed ? RESULT_TILES : BROWSE_TILES;
  const tiles = visible.slice(0, cap);
  const beyondCap = visible.length - tiles.length;
  const topMatch = visible[0];

  /** Every sport, alphabetically, for the dense index at the foot. */
  const alphabetical = [...entries].sort((a, b) => a.sportName.localeCompare(b.sportName));

  return (
    <>
      {/* ── Controls ──
          Sticky ONLY once there is enough below it to scroll past. A bar that
          pins itself over a two-sport list is a frame around nothing: it costs a
          strip of every screen and never once saves the reader a scroll back.
          `top-16` is the site header's own height. */}
      <div
        className={`z-20 mx-auto mt-9 max-w-2xl px-1 py-1 ${
          dense
            ? "border-hairline bg-paper/90 sticky top-16 rounded-2xl border px-3 py-3 backdrop-blur-md"
            : ""
        }`}
      >
        {/* Search leads, and it is the only control here by default. "Which
            sport?" is answered by typing, not by looking, a parent arrives at
            this page already knowing the word. */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            // Enter opens the top match. The list below is the slow path; a
            // parent who typed "badmin" has already chosen.
            if (topMatch) {
              const matchIndex = age === null ? -1 : findStageForAge(topMatch.stages, age);
              router.push(
                stageHref(
                  topMatch.sportSlug,
                  matchIndex >= 0 ? topMatch.stages[matchIndex]?.key : undefined
                )
              );
            }
          }}
          className="mx-auto max-w-lg"
        >
          <label htmlFor={searchId} className="sr-only">
            Search sports
          </label>
          <div className="relative">
            <Search
              aria-hidden
              strokeWidth={1.5}
              className="text-ink-muted pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${entries.length} sport${entries.length === 1 ? "" : "s"}`}
              className="border-hairline focus:border-ink/50 text-ink placeholder:text-ink-muted w-full rounded-xl border bg-white py-3.5 pl-12 pr-10 text-base transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="focus-visible:outline-ink text-ink-muted hover:bg-paper-deep hover:text-ink absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X aria-hidden className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>
          {needle && topMatch && (
            <p className="text-ink-muted mt-2 text-center text-[13px]">
              Press Enter to open{" "}
              <span className="text-ink font-semibold">{topMatch.sportName}</span>
            </p>
          )}
        </form>

        {showGroups && (
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
            {([["All", entries.length], ...groups] as Array<[SportGroup | "All", number]>).map(
              ([name, count]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setGroup(name)}
                    aria-pressed={group === name}
                    className={`focus-visible:outline-power-orange rounded-md px-3 py-1.5 text-[12.5px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      group === name
                        ? "bg-ink text-white"
                        : "border-hairline text-ink-body hover:border-ink/30 hover:text-ink border bg-white"
                    }`}
                  >
                    {name}{" "}
                    <span className={group === name ? "text-white/60" : "text-ink-muted"}>
                      {count}
                    </span>
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {/* What the controls did, for a screen reader that cannot see the grid
          shrink. Polite, so it waits for a pause in typing rather than
          interrupting every keystroke. */}
      <p aria-live="polite" className="sr-only">
        {visible.length} of {entries.length} sports match
      </p>

      {/* One optional tap that makes every card open at this child's stage. */}
      <AgeChips age={age} />

      {tiles.length > 0 ? (
        // ── One uniform grid ──
        // Three across on a laptop, two on a tablet, one on a phone, every card
        // the same width. A short last row stays short rather than stretching
        // its cards out of step with the rest.
        //
        <ul className="mt-6 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {tiles.map((entry, index) => (
            <li
              key={entry.sportSlug}
              style={{ "--i": Math.min(index, 8) } as CSSProperties}
              className={intro ? "tile-rise" : undefined}
            >
              <SportCard entry={entry} age={age} />
            </li>
          ))}
          {/* For the parent who has not chosen a sport yet. Browse view only:
              beside search results it is noise. */}
          {!narrowed && (
            <li
              style={{ "--i": Math.min(tiles.length, 8) } as CSSProperties}
              className={intro ? "tile-rise" : undefined}
            >
              <SportFinderCard />
            </li>
          )}
        </ul>
      ) : (
        // A search that finds nothing is the clearest signal this page ever gets
        // that a parent knows exactly what they want and we do not have it. It
        // ends in a route to a person, not an apology.
        <div className="border-hairline mx-auto mt-6 max-w-md rounded-2xl border bg-white p-7 text-center">
          <p className="font-editorial text-ink text-xl">
            No pathway for {needle ? `"${query.trim()}"` : "that group"} yet
          </p>
          <p className="text-ink-body mt-2 text-sm leading-relaxed">
            We write them with coaches and experienced parents, one sport at a time. Tell us about
            your child and we&apos;ll point you at the right people for their sport in the meantime.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/assessment"
              className="bg-power-orange-solid inline-flex items-center rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800"
            >
              Get a plan for their sport
            </Link>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("All");
              }}
              className="border-ink/20 text-ink hover:border-ink/50 inline-flex items-center rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              Show all sports
            </button>
          </div>
        </div>
      )}

      {/* ── What is not on screen ──
          Said plainly rather than left to a scrollbar. "Eight of fifty-four" is
          the difference between a page that looks short and a page that looks
          incomplete. */}
      {beyondCap > 0 && (
        <p className="text-ink-muted mt-4 text-center text-sm">
          {narrowed ? (
            <>
              {beyondCap} more match{beyondCap === 1 ? "" : "es"}. Keep typing to narrow it down.
            </>
          ) : (
            <>
              Showing {tiles.length} of {entries.length} sports. Search above, or open the full list
              below.
            </>
          )}
        </p>
      )}

      {/* ── The full catalogue ──
          Every published sport, as a plain link in an alphabetical index rather
          than as a fifty-first card. This is what the tiles above deliberately
          do not do: a rich card is the right shape for the few sports a parent
          is choosing between, and the wrong shape for a directory.

          A real <details>: the whole list is in the HTML whether it is open or
          not, so a crawler indexes every pathway and a parent without
          JavaScript can still open it. */}
      {entries.length > BROWSE_TILES && (
        <details className="border-hairline group mt-6 rounded-2xl border bg-white px-5 py-4 text-left">
          <summary className="text-ink-body hover:text-ink flex cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
            All {entries.length} sports, A–Z
            <ChevronDown
              aria-hidden
              className="h-4 w-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="border-hairline mt-3 columns-2 gap-x-6 border-t pt-3 sm:columns-3 lg:columns-4">
            {alphabetical.map((entry) => (
              <li key={entry.sportSlug} className="break-inside-avoid">
                <Link
                  href={`/roadmap/${entry.sportSlug}`}
                  className="text-ink-body hover:text-ink block truncate py-1 text-sm underline-offset-4 transition-colors hover:underline"
                >
                  {entry.sportName}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-ink-muted mt-6 text-center text-sm">
        More sports are being written with coaches and experienced parents, one at a time.
      </p>
    </>
  );
}
