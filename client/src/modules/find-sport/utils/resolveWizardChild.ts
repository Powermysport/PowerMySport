import { findMatchingChild, type MatchableChild } from "@/modules/player/utils/findMatchingChild";

/**
 * What the name typed on the wizard's name screen means for the child being assessed.
 *
 * The wizard pre-selects a child (the only one, or the one picked on the welcome screen) and
 * pre-fills its first name, but the field stays editable. Typing a sibling's name used to keep
 * the first child selected, so the save overwrote that child with the sibling's answers.
 *
 * - `keep`: the name still refers to the selected child, or there is no selection and no
 *   existing child by that name (a new child, answers untouched).
 * - `switch`: the name belongs to another existing child; assess that one instead.
 * - `new`: the name belongs to no existing child but a child was selected; drop the selection
 *   and the answers pre-filled from it, so the save creates a new child.
 */
export type WizardChildResolution<T> =
  { kind: "keep" } | { kind: "switch"; child: T } | { kind: "new" };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const firstName = (s: string | null | undefined) => norm(s).split(/\s+/)[0] ?? "";

function namesSameChild(typed: string, stored: string | null | undefined): boolean {
  const t = norm(typed);
  return t !== "" && (t === norm(stored) || t === firstName(stored));
}

export function resolveWizardChild<T extends MatchableChild & { _id?: string }>(
  children: readonly T[],
  selectedId: string | null,
  typedName: string
): WizardChildResolution<T> {
  if (!norm(typedName)) return { kind: "keep" };

  const selected = selectedId ? children.find((c) => c._id === selectedId) : undefined;
  if (selected && namesSameChild(typedName, selected.name)) return { kind: "keep" };

  // Full name first (the shared rule every other flow uses), then a first name that points at
  // exactly one child. Two children sharing a first name is ambiguous, so neither is picked.
  const byFullName = findMatchingChild(children, { name: typedName });
  const byFirstName = children.filter((c) => firstName(c.name) === norm(typedName));
  const match = byFullName ?? (byFirstName.length === 1 ? byFirstName[0] : null);

  if (match && match._id !== selectedId) return { kind: "switch", child: match };
  return selected ? { kind: "new" } : { kind: "keep" };
}
