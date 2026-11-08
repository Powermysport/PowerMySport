"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registered once, in the browser only: ScrollTrigger touches `window` on register.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Every motion hook runs its setup inside `gsap.matchMedia().add(MOTION_OK, ...)`.
 * A reader who asked for reduced motion never gets the setup at all, and if they
 * switch the setting while the page is open, matchMedia reverts every tween and
 * trigger it created, so the page falls back to its plain, static state.
 */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger };
