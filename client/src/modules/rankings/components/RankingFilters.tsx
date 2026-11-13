"use client";

import {
  usePlayerSuggestions,
  type PlayerSuggestion,
} from "@/modules/rankings/hooks/usePlayerSuggestions";
import { formatAsOn, type RankingDate } from "@/modules/rankings/services/api";
import { HighlightedName } from "./HighlightedName";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const EMPTY_DRAFT = { state: "", date: "", since: "", sort: "rank" };

/**
 * Search and filters for one ranking list. Same layout as the tournaments page:
 * a search box with a Search button, and one Filters button that opens the rest.
 *
 * State lives in the URL rather than in component state, so a filtered view is
 * linkable and survives a refresh — "Maharashtra U-14" is a thing a parent will
 * want to send to someone. Every change resets `page`, because landing on
 * page 7 of a filter that now returns 20 rows is the classic way these tables
 * show an empty screen and look broken.
 *
 * Search comes first in the panel and gets the width. It is not one filter among
 * several: on a list of 1,600 children, looking one up is what almost everybody
 * came to do.
 */
export function RankingFilters({
  states,
  dates,
  /**
   * The junior lists are read by parents looking for one child; the open-age
   * lists are read by adults looking for themselves. Addressing a Men's Singles
   * reader as somebody's parent is the sort of small wrongness that makes a page
   * feel like it was not written for them.
   */
  searchLabel = "Find a player",
  scope,
}: {
  states: string[];
  dates: RankingDate[];
  searchLabel?: string;
  /** Which list the box searches, so its suggestions come from that list only. */
  scope: { sport: string; category: string; subcategory: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(currentSearch);

  // Keep the box in step when the URL changes underneath it — browser back, or
  // the Clear link below.
  //
  // Adjusted during render rather than in an effect. React's own guidance for
  // "reset state when a prop changes" is to compare against the last value seen
  // and set during render: an effect for this runs a second render pass after
  // painting the stale value, which is both a wasted pass and a visible flicker
  // of the old query on a slow device.
  const [lastUrlSearch, setLastUrlSearch] = useState(currentSearch);
  if (currentSearch !== lastUrlSearch) {
    setLastUrlSearch(currentSearch);
    setSearch(currentSearch);
  }

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  const state = searchParams.get("state") ?? "";
  const date = searchParams.get("date") ?? "";
  const since = searchParams.get("since") ?? "";
  const sort = searchParams.get("sort") === "climbers" ? "climbers" : "rank";
  const { items: suggestions } = usePlayerSuggestions(search, { ...scope, state, date }, open);
  const listOpen = open && suggestions.length > 0;
  const choose = (item: PlayerSuggestion) => {
    setSearch(item.fullName);
    setOpen(false);
    setActive(-1);
    apply({ search: item.fullName });
  };

  const hasFilters = Boolean(state || date || since || currentSearch);
  const activeCount = [state, date, since].filter(Boolean).length;

  // The modal edits a draft; nothing navigates until Apply, so changing the week
  // and its comparison is one page load rather than two.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const openModal = () => {
    setDraft({ state, date, since, sort });
    dialogRef.current?.showModal();
  };
  const closeModal = () => dialogRef.current?.close();

  // Close on a click on the backdrop (the dialog element itself, not its content).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  // The list being shown is the chosen week, or the newest when none is chosen.
  // Only weeks before it can be compared with: comparing with a later week reads
  // as movement backwards in time.
  const latestWeek = dates[0]?.asOnDate.slice(0, 10) || "";
  const draftWeek = draft.date || latestWeek;
  const draftEarlierWeeks = dates.filter((entry) => entry.asOnDate.slice(0, 10) < draftWeek);

  const changeDraftWeek = (value: string) => {
    // A comparison week that is no longer earlier than the list would be refused.
    const target = value || latestWeek;
    const keepSince = draft.since && target && draft.since < target;
    setDraft((prev) => ({
      ...prev,
      date: value,
      ...(keepSince ? {} : { since: "", sort: "rank" }),
    }));
  };

  const applyFilters = () => {
    closeModal();
    apply({
      state: draft.state || null,
      date: draft.date || null,
      since: draft.since || null,
      sort: draft.since && draft.sort === "climbers" ? "climbers" : null,
    });
  };

  const fieldClass =
    "border-hairline text-ink focus-visible:border-ink h-11 w-full cursor-pointer rounded-md border bg-white px-3 text-sm outline-none transition";

  return (
    <div
      className="border-hairline rounded-xl border bg-white p-4 sm:p-5"
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
          apply({ search: search.trim() || null });
        }}
      >
        <label htmlFor="ranking-search" className="mb-2 block text-sm font-medium">
          {searchLabel}
        </label>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
            <input
              id="ranking-search"
              type="search"
              name="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpen(true);
                setActive(-1);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && suggestions.length > 0) {
                  event.preventDefault();
                  setOpen(true);
                  setActive((i) => (i + 1) % suggestions.length);
                } else if (event.key === "ArrowUp" && suggestions.length > 0) {
                  event.preventDefault();
                  setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                } else if (event.key === "Enter" && listOpen && active >= 0) {
                  // Picking a suggestion; without one highlighted, Enter is a plain search.
                  event.preventDefault();
                  choose(suggestions[active]!);
                } else if (event.key === "Escape") {
                  if (listOpen) {
                    // First Esc closes the list; a second one clears the box.
                    setOpen(false);
                    setActive(-1);
                  } else if (search) {
                    setSearch("");
                    if (currentSearch) apply({ search: null });
                  }
                }
              }}
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="ranking-search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `ranking-suggestion-${active}` : undefined}
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Name or AITA registration number"
              // The browser's own clear button is hidden: it empties the box but
              // leaves the list filtered by the old query, and it is not styled
              // like the rest of the site. The button below clears AND re-runs.
              className="border-hairline text-ink focus-visible:border-ink h-11 w-full rounded-md border bg-white pl-3 pr-11 text-sm outline-none transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  if (currentSearch) apply({ search: null });
                  document.getElementById("ranking-search")?.focus();
                }}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ink absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
            <span className="sr-only" role="status" aria-live="polite">
              {listOpen
                ? `${suggestions.length} matching ${suggestions.length === 1 ? "player" : "players"}`
                : ""}
            </span>
            {listOpen && (
              <ul
                id="ranking-search-suggestions"
                role="listbox"
                aria-label="Matching players"
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(event) => event.preventDefault()}
                className="border-hairline absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-white shadow-lg"
              >
                {suggestions.map((item, index) => (
                  <li
                    key={item.regNo}
                    id={`ranking-suggestion-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onClick={() => choose(item)}
                    onMouseEnter={() => setActive(index)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm ${
                      index === active ? "bg-muted" : ""
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <HighlightedName name={item.fullName} term={search} />
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      #{item.rank}
                      {item.state ? ` · ${item.state}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="bg-ink inline-flex h-11 min-w-24 flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-80 sm:flex-none"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Searching
              </>
            ) : (
              "Search"
            )}
          </button>
          <button
            type="button"
            onClick={openModal}
            aria-haspopup="dialog"
            className="border-hairline text-ink hover:border-ink/40 inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium transition sm:flex-none"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="bg-ink inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs tabular-nums text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </form>

      {hasFilters && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() =>
              apply({ state: null, date: null, since: null, sort: null, search: null })
            }
            className="text-ink text-sm font-medium underline underline-offset-4"
          >
            Clear all filters
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="ranking-filters-title"
        className="border-hairline m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-white p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="ranking-filters-title" className="text-ink text-lg font-medium">
            Filters
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close filters"
            className="text-muted-foreground hover:text-ink -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-md"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">State</span>
            <select
              value={draft.state}
              onChange={(event) => setDraft((prev) => ({ ...prev, state: event.target.value }))}
              className={fieldClass}
            >
              <option value="">All states</option>
              {states.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {dates.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-ink text-sm font-medium">Week</span>
              <select
                value={draft.date}
                onChange={(event) => changeDraftWeek(event.target.value)}
                className={fieldClass}
              >
                <option value="">Latest</option>
                {dates.map((entry) => {
                  const iso = entry.asOnDate.slice(0, 10);
                  return (
                    <option key={iso} value={iso}>
                      {formatAsOn(entry.asOnDate)}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {draftEarlierWeeks.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-ink text-sm font-medium">Compare with</span>
              <select
                value={draft.since}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    since: event.target.value,
                    ...(event.target.value ? {} : { sort: "rank" }),
                  }))
                }
                className={fieldClass}
              >
                <option value="">Previous list</option>
                {draftEarlierWeeks.map((entry) => {
                  const iso = entry.asOnDate.slice(0, 10);
                  return (
                    <option key={iso} value={iso}>
                      {formatAsOn(entry.asOnDate)}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {draft.since && (
            <label className="flex flex-col gap-1.5">
              <span className="text-ink text-sm font-medium">Order</span>
              <select
                value={draft.sort}
                onChange={(event) => setDraft((prev) => ({ ...prev, sort: event.target.value }))}
                className={fieldClass}
              >
                <option value="rank">By rank</option>
                <option value="climbers">Biggest climbers</option>
              </select>
            </label>
          )}
        </div>

        <div className="border-hairline flex items-center justify-between gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_DRAFT)}
            className="text-ink text-sm font-medium underline underline-offset-4"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="bg-ink h-11 rounded-md px-6 text-sm font-medium text-white transition hover:opacity-90"
          >
            Apply filters
          </button>
        </div>
      </dialog>
    </div>
  );
}
