"use client";

import { useState } from "react";
import { Button } from "@/modules/shared/ui/Button";
import { chipClass } from "../inputs/optionStyles";

type ChildOption = { _id?: string; name: string };

/**
 * Shown when a logged-in parent brings back results from a quiz they took logged out.
 * They used to be dropped silently for any account that already had children (audit F13).
 * The parent says whose results these are; nothing is saved until they do.
 */
export function SaveResultsPrompt({
  childName,
  childrenOptions,
  suggestedChildId,
  onSave,
}: {
  childName: string;
  childrenOptions: ChildOption[];
  suggestedChildId: string | null;
  onSave: (childId: string | null) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const save = async (childId: string | null) => {
    setBusy(childId ?? "new");
    setFailed(false);
    const ok = await onSave(childId);
    if (!ok) setFailed(true);
    setBusy(null);
  };

  // The child whose name matches comes first; everyone else keeps their order.
  const ordered = [...childrenOptions].sort(
    (a, b) => Number(b._id === suggestedChildId) - Number(a._id === suggestedChildId)
  );
  const hasMatch = suggestedChildId !== null;
  // Old saved results can have no name; "A new child, " with nothing after it reads as broken.
  const newLabel = childName ? `A new child, ${childName}` : "A new child";

  return (
    <section
      aria-labelledby="save-results-heading"
      className="bg-wash mb-10 rounded-2xl p-5 sm:p-6"
    >
      <h2
        id="save-results-heading"
        className="font-editorial text-ink text-2xl font-light leading-tight"
      >
        These results are not saved yet
      </h2>
      <p className="text-ink-body mt-1.5 text-sm leading-relaxed">
        You took this assessment before logging in. Choose whose profile it belongs to.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ordered.map((child) =>
          child._id === suggestedChildId ? (
            <Button
              key={child._id}
              size="sm"
              disabled={busy !== null}
              onClick={() => save(child._id ?? null)}
              className="py-2"
            >
              {busy === child._id ? "Saving..." : `Save to ${child.name}`}
            </Button>
          ) : (
            <button
              key={child._id}
              type="button"
              disabled={busy !== null}
              onClick={() => save(child._id ?? null)}
              className={`${chipClass(false)} disabled:opacity-50`}
            >
              {busy === child._id ? "Saving..." : child.name}
            </button>
          )
        )}
        {hasMatch ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => save(null)}
            className={`${chipClass(false)} disabled:opacity-50`}
          >
            {busy === "new" ? "Saving..." : newLabel}
          </button>
        ) : (
          <Button size="sm" disabled={busy !== null} onClick={() => save(null)} className="py-2">
            {busy === "new" ? "Saving..." : newLabel}
          </Button>
        )}
      </div>

      {failed && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          That did not save. Please try again.
        </p>
      )}
    </section>
  );
}
