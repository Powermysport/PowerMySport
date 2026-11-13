"use client";

import { useEffect, useState } from "react";

export interface PlayerSuggestion {
  regNo: string;
  fullName: string;
  rank: number;
  state: string | null;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const MIN_CHARS = 2;
const DEBOUNCE_MS = 150;
const CACHE_LIMIT = 60;

/** Same rule the server uses: the term starts the name, or starts a later word of it. */
export const suggestionMatches = (item: PlayerSuggestion, term: string): boolean => {
  const needle = term.trim().toLowerCase();
  const name = item.fullName.toLowerCase();
  return name.startsWith(needle) || name.includes(` ${needle}`) || item.regNo.startsWith(needle);
};

/**
 * The players on one list whose name starts like what is being typed.
 *
 * Built so the dropdown never blinks while someone types:
 *  - answers are cached per term, so backspacing is instant and costs no request;
 *  - while the next answer is on its way, the previous one stays on screen,
 *    narrowed on the spot to the names that still match what is now typed;
 *  - a request overtaken by a newer keystroke is aborted, so a slow answer for
 *    "vi" can never overwrite the one for "vikr".
 * Failure (offline, rate limited) is silent: the box is still a plain search box.
 */
export function usePlayerSuggestions(
  term: string,
  scope: { sport: string; category: string; subcategory: string; state?: string; date?: string },
  enabled: boolean
): { items: PlayerSuggestion[]; loading: boolean } {
  const { sport, category, subcategory, state, date } = scope;
  const query = term.trim();
  const scopeKey = [sport, category, subcategory, state ?? "", date ?? ""].join("|");

  // Held in state (created once) rather than a ref: it is read while rendering.
  const [cache] = useState(() => new Map<string, PlayerSuggestion[]>());
  const [latest, setLatest] = useState<{ scopeKey: string; items: PlayerSuggestion[] }>({
    scopeKey: "",
    items: [],
  });
  const [pendingFor, setPendingFor] = useState("");

  const cacheKey = `${scopeKey}|${query.toLowerCase()}`;
  const active = enabled && query.length >= MIN_CHARS;
  const cached = active ? cache.get(cacheKey) : undefined;

  useEffect(() => {
    if (!active || cache.has(cacheKey)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPendingFor(cacheKey);
      const qs = new URLSearchParams({ sport, category, subcategory, q: query });
      if (state) qs.set("state", state);
      if (date) qs.set("date", date);
      try {
        const res = await fetch(`${apiBase}/rankings/suggest?${qs.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = await res.json();
        if (body.success && Array.isArray(body.data)) {
          if (cache.size >= CACHE_LIMIT) cache.clear();
          cache.set(cacheKey, body.data);
          setLatest({ scopeKey, items: body.data });
        }
      } catch {
        /* aborted or offline: keep whatever is showing */
      } finally {
        if (!controller.signal.aborted) setPendingFor("");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cache, active, cacheKey, query, scopeKey, sport, category, subcategory, state, date]);

  if (!active) return { items: [], loading: false };
  if (cached) return { items: cached, loading: false };

  // No answer yet for this exact term: narrow the previous one if it is for the
  // same list, otherwise show nothing rather than another list's players.
  const stale = latest.scopeKey === scopeKey ? latest.items : [];
  return {
    items: stale.filter((item) => suggestionMatches(item, query)),
    loading: pendingFor === cacheKey || pendingFor === "",
  };
}
