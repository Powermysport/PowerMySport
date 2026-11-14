"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { EditionFacets, FacetOption } from "../services/editionListing";
import { tournamentListHref, type TournamentListState } from "../utils/listHref";

// ─── Search + filters for one sport's tournament list ───────────────────────
//
// State lives in the URL, so every filtered view is a shareable link and the
// back button undoes a filter. Changing a dropdown navigates at once; the
// search box navigates on Enter or the Search button.
//
// A dropdown only appears when it has a choice to offer. A sport whose
// calendar carries no event types gets no "Type of event" dropdown.

type FilterKey = "category" | "age" | "month";

const DROPDOWNS: Array<{
  key: FilterKey;
  facet: keyof EditionFacets;
  label: string;
  allLabel: string;
}> = [
  { key: "category", facet: "categories", label: "Type of event", allLabel: "All types" },
  { key: "age", facet: "ages", label: "Age group", allLabel: "All ages" },
  { key: "month", facet: "months", label: "Month", allLabel: "Any month" },
];

const controlClass =
  "border-hairline text-ink focus-visible:border-ink h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition";

function Dropdown({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  options: FacetOption[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink text-sm font-medium">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={`${controlClass} cursor-pointer`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export function EditionFilters({
  sportSlug,
  state,
  facets,
}: {
  sportSlug: string;
  state: TournamentListState;
  facets: EditionFacets;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(state.q ?? "");
  // Re-sync the box when the URL changes underneath it (back button, Clear all).
  const [seenQ, setSeenQ] = useState(state.q);
  if (seenQ !== state.q) {
    setSeenQ(state.q);
    setQuery(state.q ?? "");
  }

  const dropdowns = DROPDOWNS.filter((d) => facets[d.facet].length > 1 || Boolean(state[d.key]));
  const activeCount = DROPDOWNS.filter((d) => state[d.key]).length;
  const anyApplied = activeCount > 0 || Boolean(state.q);

  // The modal edits a draft; nothing navigates until Apply.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Pick<TournamentListState, FilterKey>>({});
  const openModal = () => {
    setDraft({ category: state.category, age: state.age, month: state.month });
    dialogRef.current?.showModal();
  };
  const closeModal = () => dialogRef.current?.close();

  // Close on a click on the backdrop (the dialog element itself, not its content).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  const go = (change: Partial<TournamentListState>) =>
    router.push(tournamentListHref(sportSlug, state, change));

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    go({ q: query.trim() || undefined });
  };

  const applyFilters = () => {
    closeModal();
    go({ category: draft.category, age: draft.age, month: draft.month });
  };

  return (
    <section
      aria-label="Search and filter tournaments"
      className="border-hairline mb-8 rounded-xl border bg-white p-4 sm:p-5"
    >
      <form role="search" onSubmit={submitSearch} className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={80}
          placeholder="Search by tournament, city or venue"
          aria-label="Search tournaments"
          className={`${controlClass} min-w-0 flex-1 basis-full sm:basis-0`}
        />
        <button
          type="submit"
          className="btn-motion bg-ink hover:bg-ink-hover h-11 flex-1 shrink-0 rounded-md px-6 text-sm font-medium text-white sm:flex-none"
        >
          Search
        </button>
        {dropdowns.length > 0 && (
          <button
            type="button"
            onClick={openModal}
            aria-haspopup="dialog"
            className="border-hairline text-ink hover:border-ink/40 inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium transition sm:flex-none"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M3 5h14M6 10h8M8.5 15h3" />
            </svg>
            Filters
            {activeCount > 0 && (
              <span className="bg-ink inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs tabular-nums text-white">
                {activeCount}
              </span>
            )}
          </button>
        )}
      </form>

      {anyApplied && (
        <div className="mt-3">
          <Link
            href={tournamentListHref(sportSlug, state, {
              category: undefined,
              age: undefined,
              month: undefined,
              q: undefined,
            })}
            className="text-ink text-sm font-medium underline underline-offset-4"
          >
            Clear all filters
          </Link>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="edition-filters-title"
        className="modal-dialog border-hairline m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-white p-0 shadow-xl"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="edition-filters-title" className="text-ink text-lg font-medium">
            Filters
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close filters"
            className="text-ink-muted hover:text-ink -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          {dropdowns.map((d) => (
            <Dropdown
              key={d.key}
              label={d.label}
              allLabel={d.allLabel}
              value={draft[d.key]}
              options={facets[d.facet]}
              onChange={(value) => setDraft((prev) => ({ ...prev, [d.key]: value }))}
            />
          ))}
        </div>
        <div className="border-hairline flex items-center justify-between gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft({})}
            className="text-ink text-sm font-medium underline underline-offset-4"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="btn-motion bg-ink hover:bg-ink-hover h-11 rounded-md px-6 text-sm font-medium text-white"
          >
            Apply filters
          </button>
        </div>
      </dialog>
    </section>
  );
}
