# 002 — Give the search suggestion lists a short entrance from the input

- **Status**: DONE (applied; timing not feel-checked, see README)
- **Commit**: c8322a4c
- **Severity**: LOW
- **Category**: Physicality & origin / Missed opportunity
- **Estimated scope**: 3 files, about 25 lines of CSS and two class-name edits

## Problem

Both player-search boxes show their suggestion list the instant the first results arrive. The list
appears below the input with no connection to it. This is an occasional action (a parent looks someone up a
few times per visit), so a small entrance is allowed, but it must stay under 200ms, must not run again on
every keystroke, and must not delay choosing a row.

Current code, verbatim:

```tsx
// client/src/modules/rankings/components/PlayerFinder.tsx:122
<ul
  id={`${id}-list`}
  role="listbox"
  aria-label="Matching players"
  // mousedown, not click: the input's blur would close the list first.
  onMouseDown={(event) => event.preventDefault()}
  className="border-hairline absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-white shadow-lg"
>
```

```tsx
// client/src/modules/rankings/components/RankingFilters.tsx (search for id="ranking-search-suggestions", about line 240)
<ul
  id="ranking-search-suggestions"
  role="listbox"
  aria-label="Matching players"
  // mousedown, not click: the input's blur would close the list first.
  onMouseDown={(event) => event.preventDefault()}
  className="border-hairline absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-white shadow-lg"
>
```

In both files the `<ul>` is mounted only while `listOpen` is true and keeps the same element while the
visitor types, so a CSS animation on mount plays once per opening, not per keystroke.

## Target

A keyframe animation on the list element, played on mount only:

- From: `opacity: 0`, `translateY(-4px)`, `scale(0.97)`.
- To: the natural state.
- `transform-origin: top` (the edge touching the input).
- 150ms, `cubic-bezier(0.23, 1, 0.32, 1)`.
- No exit animation: closing stays instant, so Escape and choosing a row feel immediate.
- Reduced motion: opacity only, 100ms. Do not remove the fade.

```css
/* client/src/app/globals.css — add after the .modal-dialog block from plan 001
   (or after .tile-rise if plan 001 has not been applied yet) */

/* ── Suggestion lists under search boxes ──
   Grows a few pixels from the input edge on mount. Runs once per opening, because
   the list element stays mounted while the visitor types. No exit: closing the
   list should feel instant. */
@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
}

@keyframes popover-fade {
  from {
    opacity: 0;
  }
}

.popover-in {
  transform-origin: top;
  animation: popover-in 150ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .popover-in {
    animation: popover-fade 100ms linear both;
  }
}
```

Then add `popover-in` to the `className` of both `<ul>` elements, at the start of the string. No other change
to either element.

## Repo conventions to follow

- Keyframes with a reduced-motion rule live in `client/src/app/globals.css`; exemplar `@keyframes tile-rise`
  and `.tile-rise` at `globals.css:549`.
- Easing is a literal `cubic-bezier(...)` in that file; there is no `--ease-*` token. Keep that.
- Motion uses `opacity` and `transform` only.

## Steps

1. Open `client/src/app/globals.css` and append the CSS block from **Target**. If plan 001 is already applied,
   put it after the `.modal-dialog` rules; otherwise after the `.tile-rise` block.
2. `client/src/modules/rankings/components/PlayerFinder.tsx:128`: change the `<ul>` `className` to
   `className="popover-in border-hairline absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-white shadow-lg"`.
3. `client/src/modules/rankings/components/RankingFilters.tsx` (the `<ul id="ranking-search-suggestions">`):
   same edit, same resulting `className`.
4. Do not change keys, handlers, ARIA attributes or the `listOpen` condition.

## Boundaries

- Do NOT animate the individual rows, and do NOT stagger them. Rows change on every keystroke; motion there
  would flicker.
- Do NOT add an exit animation or keep the list mounted after it closes.
- Do NOT touch `usePlayerSuggestions.ts`, `HighlightedName.tsx`, or the keyboard handling.
- Do NOT add dependencies or a motion library.
- If the `<ul>` markup differs from the excerpts (drift since commit c8322a4c), STOP and report.

## Verification

- **Mechanical** (from `client/`): `npx tsc --noEmit -p .` and `npx eslint
src/modules/rankings/components/PlayerFinder.tsx src/modules/rankings/components/RankingFilters.tsx` both
  print nothing; `npx prettier --check` on those files passes.
- **Feel check**: run the client. On `/rankings/tennis` type two letters in "Find a player", and on a list page
  (for example `/rankings/tennis/boys/u-16`) type two letters in its search box. Confirm:
  - The list fades in and settles about 4px down from the input edge; it does not slide from far away.
  - Continuing to type changes the rows without replaying the entrance.
  - Pressing Escape, or choosing a row, closes the list instantly with no fade-out.
  - Clearing the box and typing again replays the entrance once.
  - In DevTools Animations at 10% speed the list stays attached to the input's bottom edge throughout.
  - With `prefers-reduced-motion: reduce` the list only fades, with no movement.
  - Keyboard navigation (arrow keys, Enter) behaves exactly as before.
- **Done when**: both suggestion lists play the 150ms entrance once per opening, closing is instant, and
  keyboard behaviour is unchanged.
