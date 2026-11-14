# 001 — Give the native <dialog> filter modals an open and close motion

- **Status**: DONE (applied; timing not feel-checked, see README)
- **Commit**: c8322a4c
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Cohesion (the shared `Modal.tsx` animates, these do not)
- **Estimated scope**: 4 files, about 45 lines of CSS and three class-name edits

## Problem

Three filter modals use the browser's native `<dialog>` with `showModal()`. They appear and disappear in
one frame. The app's other modal (`client/src/modules/shared/ui/Modal.tsx`, framer-motion) fades and
scales in over 200ms, so the product has two modal behaviours. Filters are opened occasionally (a few
times a session), so a short, calm entrance is allowed; it is not a keyboard-driven or high-frequency
action.

Current code, verbatim:

```tsx
// client/src/modules/shared/ui/FilterModal.tsx:52
<dialog
  ref={ref}
  aria-labelledby={titleId}
  className="border-hairline m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border bg-white p-0 shadow-xl backdrop:bg-black/40"
>
```

```tsx
// client/src/modules/rankings/components/RankingFilters.tsx:316
<dialog
  ref={dialogRef}
  aria-labelledby="ranking-filters-title"
  className="border-hairline m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-white p-0 shadow-xl backdrop:bg-black/40"
>
```

```tsx
// client/src/modules/tournaments/components/EditionFilters.tsx:187
<dialog
  ref={dialogRef}
  aria-labelledby="edition-filters-title"
  className="border-hairline m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-white p-0 shadow-xl backdrop:bg-black/40"
>
```

`FilterModal` is used by `client/src/modules/opportunities/components/OpportunityBrowser.tsx:276`, so
changing it covers that screen too. These three `<dialog>` elements are the only native dialogs in
`client/src` (checked with `grep -rn "<dialog"`).

## Target

One shared CSS class, `modal-dialog`, that gives every native dialog the same motion:

- Open: `opacity 0 → 1` and `scale 0.96 → 1`, 200ms, `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out).
- Close: the reverse over 150ms, same curve.
- Backdrop: fades `rgb(0 0 0 / 0)` to `rgb(0 0 0 / 0.4)` over the same durations.
- Origin: centre (modals are exempt from trigger-origin scaling; they stay centred).
- Reduced motion: keep the opacity fade, drop the scale. Do not remove the transition entirely.

```css
/* client/src/app/globals.css — add after the .tile-rise block */

/* ── Native <dialog> modals (filters) ──
   Opacity and scale only. `@starting-style` gives the entrance without JS and
   `allow-discrete` on display/overlay lets the exit play before the dialog
   leaves the top layer. Browsers without support just open and close instantly,
   which is the behaviour today. */
.modal-dialog {
  opacity: 0;
  scale: 0.96;
  transition:
    opacity 150ms cubic-bezier(0.23, 1, 0.32, 1),
    scale 150ms cubic-bezier(0.23, 1, 0.32, 1),
    overlay 150ms allow-discrete,
    display 150ms allow-discrete;
}

.modal-dialog[open] {
  opacity: 1;
  scale: 1;
  transition-duration: 200ms;
}

@starting-style {
  .modal-dialog[open] {
    opacity: 0;
    scale: 0.96;
  }
}

.modal-dialog::backdrop {
  background-color: rgb(0 0 0 / 0);
  transition:
    background-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
    overlay 150ms allow-discrete,
    display 150ms allow-discrete;
}

.modal-dialog[open]::backdrop {
  background-color: rgb(0 0 0 / 0.4);
  transition-duration: 200ms;
}

@starting-style {
  .modal-dialog[open]::backdrop {
    background-color: rgb(0 0 0 / 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-dialog,
  .modal-dialog[open] {
    scale: 1;
  }
}
```

In the three `<dialog>` elements: add `modal-dialog` to `className` and **remove** `backdrop:bg-black/40`
(the new CSS owns the backdrop colour; leaving the utility would fight it).

## Repo conventions to follow

- Motion CSS lives in `client/src/app/globals.css` with a comment explaining why, and a
  `prefers-reduced-motion` block. Exemplar: `.btn-motion` (`globals.css:364`) and `.tile-rise`
  (`globals.css:549`).
- The individual `scale` property is used, not `transform`, so it composes with Tailwind v4 utilities
  (`globals.css:359` explains this).
- Easing is written as a literal `cubic-bezier(...)` in this file; there is no `--ease-*` token. Keep that.
  Do not introduce a parallel token set in this plan.

## Steps

1. Open `client/src/app/globals.css`. Append the CSS block from **Target** immediately after the
   `@media (prefers-reduced-motion: no-preference) { .tile-rise { … } }` block (about line 562).
2. `client/src/modules/shared/ui/FilterModal.tsx:55`: in the `<dialog>` `className`, replace
   `backdrop:bg-black/40` with nothing and add `modal-dialog` at the start of the string. Result:
   `className="modal-dialog border-hairline m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border bg-white p-0 shadow-xl"`.
3. `client/src/modules/rankings/components/RankingFilters.tsx:319`: same edit. Result:
   `className="modal-dialog border-hairline m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-white p-0 shadow-xl"`.
4. `client/src/modules/tournaments/components/EditionFilters.tsx:190`: same edit, same result string.
5. Do not change any JS, refs, `showModal()`/`close()` calls or the backdrop-click handlers.

## Boundaries

- Do NOT touch `client/src/modules/shared/ui/Modal.tsx` (framer-motion modal; already animated).
- Do NOT touch `ChatDrawer`, `PlannerTour`, `PathwayReader`, `LoginRequiredModal` or any `role="dialog"`
  element: they are not native `<dialog>` and are out of scope.
- Do NOT change markup structure or add dependencies.
- Do NOT animate `height`, `top` or `margin`.
- If line numbers or class strings do not match what is shown above (drift since commit c8322a4c), STOP and
  report instead of improvising.

## Verification

- **Mechanical** (run from `client/`): `npx tsc --noEmit -p .` produces no output; `npx eslint
src/modules/shared/ui/FilterModal.tsx src/modules/rankings/components/RankingFilters.tsx
src/modules/tournaments/components/EditionFilters.tsx` produces no output; `npx prettier --check` on the
  same files passes.
- **Feel check**: run the client, then open each of: the Filters button on `/rankings/tennis/boys/u-16`, the
  filters on `/tournaments`, and the filters on the opportunities page (it uses `FilterModal`). Confirm:
  - The dialog fades and grows slightly from the centre, and the dark backdrop fades with it; nothing slides.
  - Closing (Esc, the × button, a click on the backdrop) plays the shorter reverse before the dialog is
    gone, rather than vanishing.
  - Opening and closing quickly three times in a row never leaves a half-visible dialog or a stuck dark
    backdrop, and focus still returns to the Filters button.
  - In DevTools, Animations panel at 10% speed: the dialog and the backdrop move together, and nothing
    jumps at the first or last frame.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel): the dialog still fades but no longer scales.
  - In a browser without `@starting-style` support the dialogs simply open and close instantly as before.
- **Done when**: all three dialogs, plus the opportunities one, fade and scale in and out; the filter
  controls inside still work; and no page shows a stuck backdrop after closing.
