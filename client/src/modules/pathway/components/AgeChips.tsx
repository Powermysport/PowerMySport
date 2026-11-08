"use client";

// ─── "How old is your child?" on /roadmap ───────────────────────────────────
//
// One tap, and every sport card opens its guide at the stage that is about
// this child instead of at stage one. Until now the age could only be given
// inside a guide, so most parents met the index un-personalised and never
// learned that it adapts.
//
// Why exact ages, not bands ("6–9"): the age is stored as one number, shared
// with the reader's "you are here" mark and the stage matcher. A band would
// have to save a made-up single age, and then the page would tell a parent of
// a nine-year-old where "a 7-year-old" starts.
//
// Why chips, not a field: a field here was tried and removed (see the header
// of PathwayPicker): a form on the one screen whose job is "pick a sport" reads
// as a toll gate. A row of numbers reads as an option, costs one tap, and
// tapping the chosen one again clears it.
//
// The row scrolls sideways on a phone rather than wrapping into a block of
// numbers, and starts scrolled so the chosen age is in view.

import { useId } from "react";

import { rememberChildAge } from "../utils/childAge";
import { ageArticle } from "../utils/stageLabels";

/** 4 to 17, then "18+" (stored as 18). Covers every published stage's ages. */
const AGES = Array.from({ length: 15 }, (_, index) => index + 4);

const EASE = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

export function AgeChips({ age }: { age: number | null }) {
  const labelId = useId();

  return (
    <div className="mx-auto mt-6 max-w-4xl">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
        <p id={labelId} className="text-ink shrink-0 text-sm font-medium">
          How old is your child?
        </p>
        <ul
          aria-labelledby={labelId}
          className="hide-scrollbar relative -mx-4 flex max-w-[calc(100%+2rem)] snap-x gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:max-w-full sm:px-1"
        >
          {AGES.map((value) => {
            const selected = age === value || (value === 18 && age !== null && age > 18);
            return (
              <li
                key={value}
                className="shrink-0 snap-start"
                // Bring the chosen chip into view on a narrow screen.
                ref={
                  selected
                    ? (el) => {
                        const row = el?.parentElement;
                        if (el && row && row.scrollWidth > row.clientWidth) {
                          row.scrollTo({
                            left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2,
                            behavior: "instant",
                          });
                        }
                      }
                    : undefined
                }
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => rememberChildAge(selected ? null : value)}
                  className={`grid h-10 min-w-10 place-items-center rounded-lg px-2.5 text-sm font-medium tabular-nums transition-colors ${EASE} focus-visible:ring-ink focus-visible:ring-offset-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] ${
                    selected
                      ? "bg-ink text-white"
                      : "ring-ink/10 text-ink-body hover:text-ink hover:ring-ink/30 bg-white ring-1"
                  }`}
                >
                  {value === 18 ? "18+" : value}
                  <span className="sr-only">{value === 18 ? " or older" : " years old"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* What the choice did, said once, with the way back next to it. */}
      <p aria-live="polite" className="text-ink-muted mt-3 min-h-5 text-center text-sm">
        {age !== null && (
          <>
            Each guide opens where {ageArticle(age)} {age}-year-old starts.{" "}
            <button
              type="button"
              onClick={() => rememberChildAge(null)}
              className="text-ink decoration-ink/30 focus-visible:ring-ink rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
            >
              Clear
            </button>
          </>
        )}
      </p>
    </div>
  );
}
