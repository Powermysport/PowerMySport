"use client";

import Image from "next/image";
import React, { Fragment, useRef } from "react";
import { useHeroIntro } from "../../hooks/useHeroIntro";
import { HeroAskField } from "./HeroAskField";

// Sentence case: a statement, not a title.
const LEAD_WORDS = ["Helping", "parents", "make", "confident"];
const EMPHASIS_WORDS = ["sports", "decisions"];

/**
 * One headline word inside a clip mask, so it can roll up into place. The mask
 * is a `clip-path`, not `overflow: hidden`: overflow on an inline-block moves
 * its baseline to the bottom edge and would knock the line out of alignment.
 * The insets are negative so italic overhang and descenders are never cut.
 */
function MaskedWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block [clip-path:inset(-0.2em_-0.25em_-0.22em_-0.25em)]">
      <span data-hero-item data-hero-word className="inline-block will-change-transform">
        {children}
      </span>
    </span>
  );
}

/**
 * The homepage hero for visitors and parents with no child profile yet.
 *
 * An asymmetric split, read left to right: who it is for, the claim, one line
 * of explanation, then the one field and one action. The photograph sits beside
 * the text instead of below it, so it is in the first screen on a laptop rather
 * than starting at the fold. On a phone the same order stacks, left-aligned,
 * with the photo last.
 *
 * What a parent types becomes the first WhatsApp message, and the note under
 * the field says what happens after.
 *
 * Its entrance is in `useHeroIntro`. The words are split into spans for that,
 * with real spaces between them, so the heading still reads as one sentence to
 * a screen reader and wraps exactly as before.
 */
export const HeroAsk: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  useHeroIntro(ref);

  return (
    <section ref={ref} data-hero className="bg-paper">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-12 lg:items-stretch lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-7">
          <p
            data-hero-item
            data-hero-kicker
            className="text-ink-body mb-4 text-sm font-medium sm:mb-6 sm:text-base"
          >
            For parents of young athletes across India
          </p>

          {/* Heavy grotesk for the statement, an italic serif for the phrase that
              matters: the serif is larger to match the grotesk's visual weight. */}
          <h1 className="font-title text-ink text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] max-[374px]:text-[2.25rem] sm:text-[3.4rem] lg:text-[4rem] xl:text-[4.5rem]">
            {LEAD_WORDS.map((word) => (
              <Fragment key={word}>
                <MaskedWord>{word}</MaskedWord>{" "}
              </Fragment>
            ))}
            <em className="font-editorial text-[1.2em] font-light italic tracking-[-0.02em]">
              {EMPHASIS_WORDS.map((word, i) => (
                <Fragment key={word}>
                  {i > 0 && " "}
                  <MaskedWord>{word}</MaskedWord>
                </Fragment>
              ))}
            </em>
          </h1>

          <p
            data-hero-item
            data-hero-support
            className="text-ink-body mt-5 max-w-[46ch] text-pretty text-base leading-relaxed sm:mt-7 sm:text-lg"
          >
            From discovering the right sport to navigating competition and future pathways, PMS
            helps you understand your child&apos;s options, decide what to do next, and take action.
          </p>

          <div data-hero-item data-hero-support className="mt-7 max-w-xl sm:mt-10">
            <HeroAskField />
            {/* Ink-body, not muted: what happens after you send is part of the
                decision to send, so it has to clear AA at this size. */}
            <p className="text-ink-body border-hairline mt-4 border-t pt-4 text-sm leading-relaxed">
              After you message us, a PowerMySport team member replies within 24 hours.
            </p>
          </div>
        </div>

        {/* From lg the photo has no aspect ratio of its own: the grid row
            stretches it to the text column, so its top meets the kicker and its
            bottom meets the reply note. On a phone it keeps the wide 3:2 crop. */}
        <div
          data-hero-plate
          className="bg-paper-deep relative aspect-[3/2] overflow-hidden rounded-2xl lg:col-span-5 lg:aspect-auto lg:h-full"
        >
          {/* Two wrappers so the intro (camera) and the scroll drift each own a
              transform and never overwrite each other. */}
          <div data-hero-camera className="absolute inset-0">
            <div data-hero-drift className="absolute inset-0">
              <Image
                src="/images/hero-parent-child-wide.jpg"
                alt="A mother with her arm around her son, watching children play on a sports field at sunset"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                // On the tall desktop crop, centre on the arm round the boy's
                // shoulders: that gesture is the picture.
                className="object-cover lg:object-[60%_50%]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
