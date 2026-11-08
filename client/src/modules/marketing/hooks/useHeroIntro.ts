"use client";

import { type RefObject, useLayoutEffect } from "react";
import { gsap, MOTION_OK } from "./gsap";

/**
 * The homepage hero's entrance, about 1.7s end to end (the one sequence allowed
 * past a second).
 *
 * Adapted from the "UI Motion Loop" prompt in awesome-opus5-5-videos:
 *  - content arrives with a blur-in (there: 12px blur over a short fade), and
 *    words roll up vertically rather than pop;
 *  - the "camera" settles slower than the "shape": the photo's crop opens on an
 *    expo ease while the image inside it eases its scale down for longer, so the
 *    frame lands first and the picture settles into it;
 *  - beats sit on a tight grid (0.07s word stagger, the field and note one beat
 *    after the paragraph) so the order reads as headline, explanation, action.
 *
 * Pre-paint state lives in CSS (`[data-hero-item]` / `[data-hero-plate]` in
 * globals.css), not here, so the server HTML never flashes the final layout and
 * then snaps back. That CSS also carries a 2.5s failsafe: if this script never
 * runs, or runs late on a slow phone, the hero shows itself anyway, and this
 * hook then sees it already visible and leaves it alone.
 */
export function useHeroIntro(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const q = gsap.utils.selector(el);
      const words = q("[data-hero-word]");
      const kicker = q("[data-hero-kicker]");
      const supporting = q("[data-hero-support]");
      const plate = q("[data-hero-plate]");
      const camera = q("[data-hero-camera]");
      const drift = q("[data-hero-drift]");

      // The failsafe already revealed the hero (hydration took longer than
      // 2.5s). Replaying the intro now would hide words the reader is reading.
      const alreadyShown = words[0] && getComputedStyle(words[0]).opacity === "1";

      if (!alreadyShown) {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

        // The line above the headline leads in, so the reading order and the
        // arrival order match: who it is for, the claim, then the rest.
        tl.fromTo(
          kicker,
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
          0
        );

        tl.fromTo(
          words,
          { yPercent: 110, opacity: 0, filter: "blur(10px)" },
          {
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.9,
            stagger: 0.07,
            // Leaving a `filter` on text keeps it on its own layer and can soften it.
            clearProps: "filter",
          },
          0.1
        )
          .fromTo(
            supporting,
            { y: 18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.1 },
            0.4
          )
          .fromTo(
            plate,
            { clipPath: "inset(7% 7% 7% 7% round 16px)" },
            { clipPath: "inset(0% 0% 0% 0% round 16px)", duration: 1.3 },
            0.2
          )
          .fromTo(camera, { scale: 1.12 }, { scale: 1, duration: 1.5, ease: "power3.out" }, 0.2);
      }

      // Scroll-linked, so no duration: as the hero leaves, the photo drifts a
      // touch closer. Tied to scroll position, it stops the moment scrolling does.
      gsap.fromTo(
        drift,
        { scale: 1 },
        {
          scale: 1.06,
          ease: "none",
          scrollTrigger: { trigger: plate[0], start: "top 45%", end: "bottom top", scrub: true },
        }
      );
    });

    return () => mm.revert();
  }, [root]);
}
