# 004: Press feedback on the remaining solid primary buttons

- **Status**: DONE (applied; feel not checked, see README)
- **Severity**: LOW
- **Category**: Feedback

## Problem

The shared `Button` and about forty raw buttons already use `.btn-motion` (150ms colour change, 2% press).
The solid primary buttons in the screens reworked in this programme did not, and three used
`transition hover:opacity-90`, which gives a different hover from the rest of the product.

## Change

Added `btn-motion` to: the Apply buttons in `RankingFilters.tsx` (two) and `EditionFilters.tsx` (two),
the "Add" button in `SeasonSummary.tsx`, and the sign-in link in `PlannerApp.tsx`. Replaced
`transition hover:opacity-90` with `hover:bg-ink-hover` so the hover is a colour change like the others.

## Not done

About 30 other raw solid buttons still lack `btn-motion` (checkout, onboarding, shop, pathway). Adopt
them when those screens are next opened for real work, not in a sweep.
