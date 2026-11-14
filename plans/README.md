# Animation plans

Written by `improve-animations plan`, from the `find-animation-opportunities` report on the client. Each plan
is self-contained and stamped with the commit it was written against (`c8322a4c`).

| #   | Title                                                                         | Severity | Status |
| --- | ----------------------------------------------------------------------------- | -------- | ------ |
| 001 | [Native dialog open and close motion](001-native-dialog-open-close-motion.md) | MEDIUM   | DONE   |
| 002 | [Suggestion list entrance from the input](002-suggestion-popover-entrance.md) | LOW      | DONE   |

Both applied on top of `c8322a4c`. Checked: prettier, typecheck, lint; the dialog's transitions
(opacity and scale, 200ms, strong ease-out) and end states in two browsers; the suggestion list's
150ms `popover-in` animation. Not checked: how the motion looks and feels in real time (the in-app
browser's animation clock does not advance, and the Chrome tab was in the background), so the plans'
feel-check steps (10% playback, rapid open and close, reduced motion) are still worth doing by eye.

## Order and dependencies

1. **001 first.** It is the more visible one (three modals, one of them shared) and removes the difference with
   the framer-motion `Modal.tsx`.
2. **002 second.** Independent of 001, but both append to `client/src/app/globals.css`, so run them one after
   the other, not in parallel, to avoid a merge conflict in that file.

Not planned (rejected in the report): animating the player tabs, rankings tables and chart, list-row staggers,
and hold-to-confirm on account deletion. Planned next if wanted: the planner's `CostLine` and `<details>`
panels that snap open (opportunity 3) and adopting `.btn-motion` on more buttons (opportunity 4).
