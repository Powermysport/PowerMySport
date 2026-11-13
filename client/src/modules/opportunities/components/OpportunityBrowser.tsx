"use client";

import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { FilterModal } from "@/modules/shared/ui/FilterModal";
import { MessageCircle, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import { GROUP_THRESHOLD, TRACKS, askUsHref } from "../config/tracks";
import type { Opportunity, OpportunityTrack } from "../services/opportunities";
import { formatDay } from "../utils/format";
import { VERDICT_ORDER, checkOpportunity, hasProfile, type Verdict } from "../utils/match";
import { matchesQuery } from "../utils/search";
import { OpportunityRow, OpportunityTableHead } from "./OpportunityRow";
import { AgeField, GenderField, SportField, StateField } from "./ProfileFields";

// ─── The list on /admissions and /scholarships ───────────────────────────
//
// Three things the plain server list could not do:
//  - it adapts to how much there is. A handful of entries is shown as one list
//    with the category on each card, not as five headed sections that are
//    mostly empty;
//  - once a parent says who the child is, it marks each entry as fitting, worth
//    checking or not a match, and puts the ones that fit first;
//  - when the list is short or comes up empty it says so, and offers a person.
//
// One panel, the same as the tournaments page: a search box, and a Filters
// button that opens the rest (sport, type, and the answers about the child).
// Typing filters the list as you go; there is nothing to submit. Sport
// FILTERS (a tennis parent has no use for a badminton-only scheme); age, boy or
// girl and state only MARK, because a "does not match" is still worth seeing
// when the rule might bend. `?sport=` in the URL is an entry point only: it
// seeds the field, and any change from here filters in the browser.
//
// The server still renders every card (this is a client component, not a
// client-only one), so the page reads fully with no JavaScript and to a crawler.

export function OpportunityBrowser({
  track,
  items,
  sports,
  categories,
  today,
  selectedSport,
}: {
  track: OpportunityTrack;
  items: Opportunity[];
  /** Sport-specific slugs present in this track, for the sport filter. */
  sports: string[];
  /** The track's categories in display order. */
  categories: string[];
  /** India's date from the server, so every "days left" agrees. */
  today: string;
  selectedSport?: string | undefined;
}) {
  const config = TRACKS[track];
  const router = useRouter();
  const { profile, hydrated, setField, clear } = useOpportunityProfile();
  const known = hasProfile(profile);
  const [hideMismatches, setHideMismatches] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  // A link to ?sport=tennis means "tennis", whatever was remembered before.
  useEffect(() => {
    if (hydrated && selectedSport && sports.includes(selectedSport)) {
      setField("sport", selectedSport);
    }
  }, [hydrated, selectedSport, sports, setField]);

  // A remembered sport this track has nothing specific for (chess on a page
  // with no chess entries) does not filter; the field shows "All sports".
  const rememberedSport = profile.sport && sports.includes(profile.sport) ? profile.sport : null;
  // Before the saved profile is read, the URL is the only answer.
  const activeSport = hydrated ? rememberedSport : (selectedSport ?? null);

  const changeSport = (next: string | null) => {
    setCategory(null);
    // The server list was cut to the URL's sport; widen it again so the
    // browser can filter to the new one.
    if (selectedSport && next !== selectedSport) {
      router.replace(config.path, { scroll: false });
    }
  };

  const clearAll = () => {
    clear();
    setCategory(null);
    setQuery("");
    setHideMismatches(false);
    if (selectedSport) router.replace(config.path, { scroll: false });
  };

  const verdicts = useMemo(() => {
    const map = new Map<string, Verdict | null>();
    for (const item of items) map.set(item.slug, checkOpportunity(item, profile).verdict);
    return map;
  }, [items, profile]);

  const flat = items.length < GROUP_THRESHOLD;
  const sportItems = useMemo(
    () =>
      activeSport
        ? items.filter((item) => item.allSports || item.sports.includes(activeSport))
        : items,
    [items, activeSport]
  );
  // Only the types the chosen sport actually has, so no button leads to nothing.
  const presentCategories = categories.filter((name) =>
    sportItems.some((item) => item.category === name)
  );
  const showTypes = flat && presentCategories.length > 1;

  // What the sport and type filters leave, before "hide the ones that do not match".
  const pool = useMemo(
    () =>
      sportItems.filter(
        (item) =>
          (!category || item.category === category) &&
          matchesQuery(item, query, config.categories[item.category]?.label)
      ),
    [sportItems, category, query, config]
  );

  const counts = useMemo(() => {
    const tally = { fits: 0, check: 0, no: 0 };
    for (const item of pool) {
      const verdict = verdicts.get(item.slug);
      if (verdict) tally[verdict] += 1;
    }
    return tally;
  }, [pool, verdicts]);

  const shown = useMemo(() => {
    const kept = hideMismatches ? pool.filter((item) => verdicts.get(item.slug) !== "no") : pool;
    if (!known) return kept;
    // Stable: ties keep the server's order (open windows first).
    return kept
      .map((item, index) => ({ item, index }))
      .sort(
        (a, b) =>
          VERDICT_ORDER[verdicts.get(a.item.slug) ?? "none"] -
            VERDICT_ORDER[verdicts.get(b.item.slug) ?? "none"] || a.index - b.index
      )
      .map(({ item }) => item);
  }, [pool, hideMismatches, known, verdicts]);

  const latestCheck = items
    .map((item) => item.lastVerifiedOn)
    .filter((day): day is string => Boolean(day))
    .sort()
    .at(-1);
  const nounFor = (n: number) =>
    track === "scholarship"
      ? n === 1
        ? "scholarship"
        : "scholarships"
      : n === 1
        ? "option"
        : "options";
  const plural = track === "scholarship" ? "scholarships" : "admissions";
  const narrowed = shown.length !== items.length;
  const anythingSet = known || category !== null || hideMismatches || query.trim() !== "";
  // What the Filters button counts: the choices inside the modal.
  const filterCount = [activeSport, category, profile.age, profile.gender, profile.state].filter(
    (value) => value !== null && value !== undefined && value !== ""
  ).length;
  const askLabel = activeSport ? (SPORT_LABEL[activeSport] ?? activeSport) : undefined;

  const card = (item: Opportunity, withCategory: boolean) => (
    <li key={item.slug}>
      <OpportunityRow
        opportunity={item}
        today={today}
        categoryLabel={withCategory ? config.categories[item.category]?.label : undefined}
        verdict={known ? (verdicts.get(item.slug) ?? null) : null}
      />
    </li>
  );

  return (
    <div className="space-y-8">
      {items.length > 0 && (
        <div className="space-y-4">
          <section
            aria-label={`Search and filter ${plural}`}
            className="border-hairline rounded-xl border bg-white p-4 sm:p-5"
          >
            <form
              role="search"
              onSubmit={(event) => {
                // The list already follows what is typed. Search is for the
                // moment a visitor feels done: put the phone keyboard away and
                // bring the results into view.
                event.preventDefault();
                document.getElementById("opportunity-search")?.blur();
                document
                  .getElementById("opportunity-results")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <label
                htmlFor="opportunity-search"
                className="text-ink mb-2 block text-sm font-medium"
              >
                {`Find ${plural} for your child`}
              </label>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
                  <input
                    id="opportunity-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && query) setQuery("");
                    }}
                    maxLength={80}
                    placeholder="Search by name, organisation or sport"
                    enterKeyHint="search"
                    autoComplete="off"
                    className="border-hairline text-ink focus-visible:border-ink h-11 w-full rounded-md border bg-white pl-3 pr-11 text-sm outline-none transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery("");
                        document.getElementById("opportunity-search")?.focus();
                      }}
                      className="text-ink-muted hover:text-ink focus-visible:ring-ink absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-ink inline-flex h-11 flex-1 shrink-0 items-center justify-center rounded-md px-6 text-sm font-medium text-white transition hover:opacity-90 sm:flex-none"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  aria-haspopup="dialog"
                  className="border-hairline text-ink hover:border-ink/40 inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-md border bg-white px-4 text-sm font-medium transition sm:flex-none"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  Filters
                  {filterCount > 0 && (
                    <span className="bg-ink inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-xs tabular-nums text-white">
                      {filterCount}
                    </span>
                  )}
                </button>
              </div>
            </form>

            {anythingSet && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-ink text-sm font-medium underline underline-offset-4"
                >
                  Clear all filters
                </button>
              </div>
            )}

            <FilterModal
              open={filtersOpen}
              onClose={closeFilters}
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      clear();
                      setCategory(null);
                      if (selectedSport) router.replace(config.path, { scroll: false });
                    }}
                    className="text-ink text-sm font-medium underline underline-offset-4"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={closeFilters}
                    className="bg-ink h-11 rounded-md px-6 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    {`Show ${shown.length} ${nounFor(shown.length)}`}
                  </button>
                </>
              }
            >
              <SportField
                sports={sports}
                value={activeSport ?? ""}
                placeholder="All sports"
                onChange={changeSport}
              />

              {showTypes && (
                <div>
                  <label
                    htmlFor="opportunity-type"
                    className="text-ink mb-1.5 block text-sm font-medium"
                  >
                    Type
                  </label>
                  <select
                    id="opportunity-type"
                    value={category ?? ""}
                    onChange={(event) => setCategory(event.target.value || null)}
                    className="border-hairline text-ink focus-visible:border-ink h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition"
                  >
                    <option value="">All types</option>
                    {presentCategories.map((name) => (
                      <option key={name} value={name}>
                        {config.categories[name]?.label ?? name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-hairline space-y-4 border-t pt-4">
                <p className="text-ink-body text-sm">
                  Tell us about your child and we mark which ones match. Your answers stay on this
                  device.
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                  <AgeField className="min-w-0" />
                  <GenderField className="min-w-0" />
                  <StateField className="col-span-2" />
                </div>
              </div>
            </FilterModal>
          </section>

          {/* Right above the list it describes, and announced as it changes. */}
          <div
            id="opportunity-results"
            role="status"
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm"
          >
            <p className="text-ink-body">
              <span className="text-ink font-medium">
                {/* With a sport chosen the server may already have cut the list, so
                    "of N" could be the wrong N; name the sport instead. */}
                {askLabel
                  ? `${shown.length} ${nounFor(shown.length)} for ${askLabel}`
                  : narrowed
                    ? `Showing ${shown.length} of ${items.length} ${nounFor(items.length)}`
                    : `${items.length} ${nounFor(items.length)} listed so far`}
              </span>
              {/* Only the counts that are not zero: "0 match" is noise. */}
              {known &&
                [
                  { n: counts.fits, text: "match", tone: "text-green-700" },
                  { n: counts.check, text: "to check", tone: "text-ink" },
                  { n: counts.no, text: "do not match", tone: "text-ink-muted" },
                ]
                  .filter((part) => part.n > 0)
                  .map((part, index) => (
                    <span key={part.text}>
                      {index === 0 ? ": " : " · "}
                      <span className={`font-medium ${part.tone}`}>
                        {part.n} {part.text}
                      </span>
                    </span>
                  ))}
            </p>
            {known && counts.no > 0 && (
              <label className="text-ink-body flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hideMismatches}
                  onChange={(e) => setHideMismatches(e.target.checked)}
                  className="accent-ink h-4 w-4"
                />
                Hide the ones that do not match
              </label>
            )}
          </div>
          {latestCheck && (
            <p className="text-ink-muted -mt-2 text-sm">
              Last checked on {formatDay(latestCheck)}.
              {flat && " We add more once we have checked each one on its official website."}
            </p>
          )}
        </div>
      )}

      {shown.length > 0 ? (
        flat ? (
          <div>
            <OpportunityTableHead />
            <ul className="divide-hairline border-hairline divide-y border-b">
              {shown.map((item) => card(item, presentCategories.length > 1))}
            </ul>
          </div>
        ) : (
          categories
            .map((name) => ({
              name,
              meta: config.categories[name],
              entries: shown.filter((item) => item.category === name),
            }))
            .filter((section) => section.meta && section.entries.length > 0)
            .map((section) => (
              <section key={section.name} aria-labelledby={`section-${section.name}`}>
                <h2
                  id={`section-${section.name}`}
                  className="font-editorial text-ink text-3xl font-light tracking-tight"
                >
                  {section.meta!.label}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{section.meta!.blurb}</p>
                <div className="mt-6">
                  <OpportunityTableHead />
                  <ul className="divide-hairline border-hairline divide-y border-b">
                    {section.entries.map((item) => card(item, false))}
                  </ul>
                </div>
              </section>
            ))
        )
      ) : items.length > 0 ? (
        <p className="border-hairline rounded-xl border border-dashed px-6 py-10 text-center text-sm text-slate-700">
          Nothing matches these choices. Remove a filter, or ask us below.
        </p>
      ) : (
        <div className="border-hairline rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">
            We are still checking these on their official websites.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            We add each one only after a person has checked it, so you never chase a deadline that
            has changed.
          </p>
        </div>
      )}

      {(flat || items.length === 0 || shown.length === 0) && (
        <aside className="border-hairline flex flex-wrap items-center justify-between gap-4 border-t pt-8">
          <div className="max-w-xl">
            <h2 className="font-editorial text-base font-light text-slate-900">
              Can&apos;t find what you need? Tell us what you are looking for.
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Message us on WhatsApp and a real person will reply with what we know. Your question
              also helps us decide what to add next.
            </p>
          </div>
          <a
            href={askUsHref(track, askLabel)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-motion focus-visible:ring-power-orange-solid inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <MessageCircle aria-hidden className="h-4 w-4" />
            Ask on WhatsApp
          </a>
        </aside>
      )}
    </div>
  );
}
