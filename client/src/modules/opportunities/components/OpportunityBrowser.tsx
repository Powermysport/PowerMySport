"use client";

import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useOpportunityProfile } from "../hooks/useOpportunityProfile";
import { GROUP_THRESHOLD, TRACKS, askUsHref } from "../config/tracks";
import type { Opportunity, OpportunityTrack } from "../services/opportunities";
import { formatDay } from "../utils/format";
import { VERDICT_ORDER, checkOpportunity, hasProfile, type Verdict } from "../utils/match";
import { OpportunityRow, OpportunityTableHead } from "./OpportunityRow";
import { ProfileFields } from "./ProfileFields";

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
// All the controls live in one panel, and there is one sport control. Sport
// FILTERS (a tennis parent has no use for a badminton-only scheme); age, boy or
// girl and state only MARK, because a "does not match" is still worth seeing
// when the rule might bend. `?sport=` in the URL is an entry point only: it
// seeds the field, and any change from here filters in the browser.
//
// The server still renders every card (this is a client component, not a
// client-only one), so the page reads fully with no JavaScript and to a crawler.

const chipClass = (active: boolean) =>
  `btn-motion focus-visible:ring-ink min-h-9 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 ${
    active
      ? "bg-ink border-ink text-white"
      : "border-hairline text-ink hover:border-ink/40 bg-white"
  }`;

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
    () => (category ? sportItems.filter((item) => item.category === category) : sportItems),
    [sportItems, category]
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
  const narrowed = shown.length !== items.length;
  const anythingSet = known || category !== null || hideMismatches;
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
            aria-labelledby="find-fit-heading"
            className="border-hairline rounded-2xl border bg-white"
          >
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="find-fit-heading"
                  className="font-editorial text-ink text-balance text-2xl font-light tracking-tight"
                >
                  Narrow the list to your child
                </h2>
                {anythingSet && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink shrink-0 rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <p className="text-ink-body mt-1.5 max-w-[60ch] text-pretty text-sm leading-relaxed">
                Choose a sport to see only what is open to it. Add age, boy or girl, and state, and
                we mark which ones match. Your answers stay on this device.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <ProfileFields
                sports={sports}
                sportValue={activeSport ?? ""}
                sportPlaceholder="All sports"
                onSportChange={changeSport}
              />
            </div>

            {showTypes && (
              <div className="border-hairline flex flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                <span id="type-filter-label" className="text-ink shrink-0 text-sm font-medium">
                  Type
                </span>
                <div
                  role="group"
                  aria-labelledby="type-filter-label"
                  className="flex flex-wrap gap-2"
                >
                  {[null, ...presentCategories].map((name) => (
                    <button
                      key={name ?? "all"}
                      type="button"
                      aria-pressed={name === category}
                      onClick={() => setCategory(name)}
                      className={chipClass(name === category)}
                    >
                      {name ? config.categories[name]?.label : "All types"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right above the list it describes, and announced as it changes. */}
          <div
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
