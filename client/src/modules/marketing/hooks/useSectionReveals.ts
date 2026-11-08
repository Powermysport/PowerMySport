"use client";

import { type RefObject, useLayoutEffect } from "react";
import { gsap, MOTION_OK, ScrollTrigger } from "./gsap";

/**
 * Scroll-triggered section reveals for the homepage, built on ScrollTrigger.
 *
 * It reuses the `.reveal-on-scroll` markers the sections already carry, so no
 * section component needs to know about GSAP. While it runs it adds
 * `gsap-reveals` to the root, which switches off the CSS scroll-driven version
 * of the same reveal (globals.css) so the two never stack.
 *
 * Adapted from the "Widget Animation" prompt in awesome-opus5-5-videos, where a
 * card scales up and settles, its rows then slide in one after another, and a
 * graph line draws itself last. Here, toned down for reading:
 *  - text blocks rise 24px and fade (no blur: blurring paragraphs is heavy on
 *    phones and makes words unreadable mid-flight);
 *  - lists reveal item by item as each one enters, not all at once;
 *  - a block marked `data-reveal="settle"` (a card) scales from 0.97 and settles,
 *    then its `[data-reveal-row]` rows slide in, in order;
 *  - a block marked `data-reveal-line` draws its connector line after its text,
 *    by tweening the `--draw` custom property its CSS line is scaled by.
 *
 * Every tween is 0.45s to 0.7s and staggers are capped, so no reveal takes a
 * second. Everything starts visible in the server HTML; hiding happens here, in
 * a layout effect, before the browser's first paint after hydration.
 */
export function useSectionReveals(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      el.classList.add("gsap-reveals");

      // Lists reveal per item, so a long list on a phone does not finish
      // animating while its lower half is still off screen.
      const targets: HTMLElement[] = [];
      gsap.utils.toArray<HTMLElement>(el.querySelectorAll(".reveal-on-scroll")).forEach((block) => {
        if (block.closest("[data-hero]")) return;
        if (block.matches("ul, ol")) targets.push(...(Array.from(block.children) as HTMLElement[]));
        else targets.push(block);
      });

      const settles = targets.filter((t) => t.dataset.reveal === "settle");
      const rises = targets.filter((t) => t.dataset.reveal !== "settle");
      const lines = targets.filter((t) => t.hasAttribute("data-reveal-line"));

      gsap.set(rises, { opacity: 0, y: 24 });
      gsap.set(settles, { opacity: 0, y: 16, scale: 0.97 });
      gsap.set(lines, { "--draw": 0 });
      settles.forEach((card) =>
        gsap.set(card.querySelectorAll("[data-reveal-row]"), { opacity: 0, x: -12 })
      );

      ScrollTrigger.batch(targets, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => {
          batch.forEach((node, i) => {
            const target = node as HTMLElement;
            // Items that enter together go in order, 0.08s apart, capped at 0.24s.
            const delay = Math.min(i * 0.08, 0.24);

            if (target.dataset.reveal === "settle") {
              gsap.to(target, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.7,
                ease: "expo.out",
                delay,
              });
              gsap.to(target.querySelectorAll("[data-reveal-row]"), {
                opacity: 1,
                x: 0,
                duration: 0.45,
                ease: "power3.out",
                stagger: { amount: 0.25 },
                delay: delay + 0.2,
              });
            } else {
              gsap.to(target, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay });
            }

            if (target.hasAttribute("data-reveal-line")) {
              gsap.to(target, {
                "--draw": 1,
                duration: 0.6,
                ease: "power2.inOut",
                delay: delay + 0.25,
              });
            }
          });
        },
      });

      // The one full-bleed photograph: it settles from slightly close-up as its
      // section scrolls in. Scroll-linked (scrub), so it moves only while the
      // reader scrolls and never on its own.
      gsap.utils
        .toArray<HTMLElement>(el.querySelectorAll("[data-reveal-camera]"))
        .forEach((img) => {
          gsap.fromTo(
            img,
            { scale: 1.08 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: img.closest("section") ?? img,
                start: "top bottom",
                end: "center center",
                scrub: true,
              },
            }
          );
        });

      // Trigger positions are measured once. The page keeps changing height after
      // that (the tournaments board, images, signed-in content), and stale
      // positions leave the lowest sections waiting for a scroll point that no
      // longer exists, so they would stay hidden. Re-measure when the page resizes.
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      const resize = new ResizeObserver(() => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
      });
      resize.observe(el);

      return () => {
        resize.disconnect();
        clearTimeout(refreshTimer);
        el.classList.remove("gsap-reveals");
      };
    });

    return () => mm.revert();
  }, [root]);
}
