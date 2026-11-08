import { Check } from "lucide-react";

/**
 * One selection language for every answer in the wizard, per client/DESIGN.md: answers sit
 * on a white surface (forms read as documents), separated by hairlines; the chosen one is
 * marked in ink, never orange, because orange is kept for the single primary action.
 */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/** An answer card: a whole option the parent picks. */
export const optionClass = (selected: boolean) =>
  `w-full rounded-xl border bg-white text-left transition-colors duration-200 ${FOCUS} ${
    selected ? "border-ink ring-1 ring-ink" : "border-hairline hover:border-ink/40"
  }`;

/** A chip: one item in a pick-several list (sports, states). */
export const chipClass = (selected: boolean) =>
  `rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${FOCUS} ${
    selected
      ? "border-ink bg-ink text-white"
      : "border-hairline bg-white text-ink-body hover:border-ink/40"
  }`;

/** A text, date or search field. 16px text so phones do not zoom in on focus. */
export const fieldClass =
  "w-full rounded-md border border-hairline bg-white px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink";

/** The small round mark beside an option: empty, or an ink check once chosen. */
export function SelectMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
        selected ? "border-ink bg-ink text-white" : "border-ink/25 bg-white"
      }`}
    >
      {selected && <Check className="h-3 w-3" strokeWidth={2.5} />}
    </span>
  );
}
