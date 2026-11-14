# 003: Short entrance for the planner's disclosure panels

- **Status**: DONE (applied; timing not feel-checked, see README)
- **Severity**: LOW
- **Category**: Preventing a jarring change

## Problem

The planner's "How this is worked out" panel (`CostLine.tsx`) and the "If you withdraw late or do not
turn up" `<details>` (`OfficialDetails.tsx`) snap open. Both are occasional, parent-initiated actions.

## Change

`.disclosure-in` in `client/src/app/globals.css`: 180ms, `cubic-bezier(0.23, 1, 0.32, 1)`, opacity 0 and
`translateY(-4px)` to rest. Played once per opening. For `<details>` it targets `[open] > :not(summary)`.
No exit; closing stays instant. Reduced motion: 100ms fade, no movement.

## Boundaries

Opacity and transform only. Do not animate height. Do not touch `FigureForm` or the edit flow.

## Feel check

Open and close each panel at normal speed and at 10% in the DevTools Animations panel; repeat with
`prefers-reduced-motion: reduce`.
