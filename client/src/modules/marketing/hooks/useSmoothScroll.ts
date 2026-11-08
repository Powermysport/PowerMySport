"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, MOTION_OK, ScrollTrigger } from "./gsap";

/**
 * Lenis smooth scrolling for the page that calls it, driven by GSAP's ticker so
 * Lenis and ScrollTrigger read the same scroll position on the same frame.
 *
 * Scoped to a page rather than the root layout on purpose: the app's dashboards,
 * modals and chat panels have their own scroll areas, and the marketing pages
 * are the only place the extra polish earns its risk. Torn down on unmount, so a
 * client-side navigation away leaves native scrolling exactly as it was.
 *
 * Touch devices keep native scrolling (Lenis's default `syncTouch: false`), so a
 * phone gets its own momentum, not an emulation of it.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      // `allowNestedScroll`: a wheel over a scrollable child (the AI assistant
      // panel, a long dropdown) scrolls that child, not the page behind it.
      const lenis = new Lenis({ allowNestedScroll: true });
      lenis.on("scroll", ScrollTrigger.update);

      // A named function rather than an inline arrow so cleanup can remove it.
      const tick = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      return () => {
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33); // GSAP's default
        lenis.destroy();
      };
    });

    return () => mm.revert();
  }, []);
}
