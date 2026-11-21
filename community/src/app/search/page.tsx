"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunitySearchItem } from "@/modules/community/types";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { useDebouncedSearch } from "@/lib/hooks";
import { toast } from "@/lib/toast";

type SearchScope = "ALL" | "POST" | "BLOG";

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "POST", label: "Questions" },
  { value: "BLOG", label: "Experiences" },
];

export default function CommunitySearchPage() {
  return (
    <Suspense
      fallback={
        <div className="community-page-shell" aria-busy="true" aria-label="Loading search">
          <div className="community-content-wrap">
            <div className="bg-paper-deep h-40 animate-pulse rounded-2xl" />
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [initialQuery] = useState(() => searchParams.get("q") || "");
  const [scope, setScope] = useState<SearchScope>(
    (searchParams.get("type") as SearchScope) || "ALL"
  );

  // The shared hook already debounces, enforces the two-character floor and
  // aborts superseded requests, so typing fast cannot land an older response
  // on top of a newer one.
  const searchFn = useCallback(
    async (term: string): Promise<CommunitySearchItem[]> => {
      const result = await communityService.search(term, scope);
      return result.items;
    },
    [scope]
  );

  const { query, setQuery, displayQuery, results, isSearching, error } =
    useDebouncedSearch<CommunitySearchItem>(searchFn);

  const items = results;

  // Seed from the URL so a shared link runs its own search.
  useEffect(() => {
    const initial = searchParams.get("q") || "";
    if (initial) {
      setQuery(initial);
    }
    // Deliberately once, on mount: afterwards the input owns the query and
    // re-reading the URL would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Search failed");
    }
  }, [error]);

  // Keeps the URL shareable without pushing a history entry per keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (displayQuery.trim()) params.set("q", displayQuery.trim());
    if (scope !== "ALL") params.set("type", scope);
    const search = params.toString();
    router.replace(search ? `/search?${search}` : "/search", { scroll: false });
  }, [displayQuery, scope, router]);

  const term = displayQuery.trim();
  const hasTerm = term.length >= 2;
  const total = items.length;

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap">
        <CommunityPageHeader
          title="Search"
          subtitle="Find questions and experiences across the community."
        />

        <div className="mt-6 space-y-4 sm:mt-8">
          <div
            role="search"
            className="focus-within:border-ink hover:border-ink/45 flex w-full items-center rounded-md border border-[#d9d3c8] bg-white transition-colors duration-200"
          >
            <Search
              size={18}
              className="text-ink-muted pointer-events-none ml-4 shrink-0"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Only grab focus on a fresh visit. Arriving with ?q= already
              // filled, autofocus pops the keyboard over the results on a phone.
              autoFocus={!initialQuery}
              placeholder="Search questions and experiences"
              aria-label="Search questions and experiences"
              className="text-ink placeholder:text-ink-muted h-12 w-full bg-transparent px-3 text-base outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-ink-muted hover:text-ink flex h-12 w-12 shrink-0 items-center justify-center transition-colors duration-200"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div role="group" aria-label="Search in" className="flex flex-wrap gap-2">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={scope === option.value}
                onClick={() => setScope(option.value)}
                className={`btn-motion min-h-11 rounded-md border px-4 text-sm font-medium sm:min-h-10 ${
                  scope === option.value
                    ? "border-ink bg-ink text-white"
                    : "border-hairline text-ink-body hover:border-ink/45 hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {isSearching ? (
            <div aria-busy="true" aria-label="Searching" className="border-hairline border-t">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-hairline space-y-3 border-b py-6">
                  <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                  <div className="bg-ink/10 h-6 w-2/3 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="bg-paper-deep rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">Search did not work.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                That was a problem on our side, not a lack of results. Check your connection and try
                again.
              </p>
              <button
                type="button"
                onClick={() => setQuery(`${query} `.trimEnd())}
                className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
              >
                Try again
              </button>
            </div>
          ) : hasTerm && total === 0 ? (
            <div className="bg-paper-deep rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light [overflow-wrap:anywhere]">
                Nothing found for &ldquo;{term}&rdquo;.
              </p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Try fewer words, or ask the community directly.
              </p>
              <Link
                href={`/questions?ask=1&title=${encodeURIComponent(term.slice(0, 200))}`}
                className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
              >
                Ask this as a question
              </Link>
            </div>
          ) : total > 0 ? (
            <>
              <p role="status" className="text-ink-muted mb-3 text-sm tabular-nums">
                {total.toLocaleString("en-IN")} {total === 1 ? "result" : "results"} for &ldquo;
                {term}&rdquo;
              </p>
              <ul className="border-hairline border-t">
                {items.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="border-hairline border-b">
                    <Link
                      href={item.href}
                      className="hover:bg-paper-deep/60 group -mx-3 block px-3 py-6 transition-colors duration-200"
                    >
                      <p className="text-ink-muted text-sm">
                        {item.kind === "POST" ? "Question" : "Experience"}
                        {item.sport ? ` · ${item.sport}` : ""}
                        {item.isSolved ? (
                          <span className="font-semibold text-green-800"> · Solved</span>
                        ) : null}
                      </p>
                      <p className="font-editorial text-ink decoration-ink/30 mt-1 line-clamp-3 text-2xl font-normal leading-tight underline-offset-4 [overflow-wrap:anywhere] group-hover:underline">
                        {item.title}
                      </p>
                      {item.snippet ? (
                        <p className="text-ink-body mt-2 line-clamp-2 max-w-[64ch] text-base leading-relaxed [overflow-wrap:anywhere]">
                          {item.snippet}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-body text-base">
              {term.length === 1
                ? "Add one more character to search."
                : "Type at least two characters to search."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
