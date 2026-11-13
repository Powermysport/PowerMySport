import type { PipelineStage, Types } from "mongoose";
import { RankingEntry } from "../../models/RankingEntry";
import { log } from "../../../utils/logger";

// ─── Typo-tolerant player search, on top of the regex search ────────────────
//
// The ranking list's regex search finds a name that is typed correctly
// ("sharma"). It cannot find "sarma" or "shrama". Atlas Search can, so when it
// is switched on its matches are ADDED to the regex ones: the result is never
// smaller than what the regex alone returns, and a missing or broken index
// degrades to exactly the old behaviour.
//
// Off by default. Turn on with ATLAS_SEARCH_ENABLED=true after the
// `ranking_name_search` index exists (definition: src/shared/services/ranking/ATLAS_SEARCH.md).
// A $search stage against a cluster or index that does not have it throws, and
// this must never be the reason a ranking page fails.

export const RANKING_SEARCH_INDEX = "ranking_name_search";
const MAX_TERM_LENGTH = 100;
/** A list is under 2,000 rows, so a name rarely matches more than a few dozen. */
const MAX_MATCHES = 200;
const MAX_TIME_MS = 1500;
/** After a failure, skip Atlas for a while instead of timing out on every keystroke. */
const BACKOFF_MS = 60_000;

let skipUntil = 0;

export const atlasSearchEnabled = (): boolean => process.env.ATLAS_SEARCH_ENABLED === "true";

export interface PlayerSearchScope {
  sportSlug: string;
  category: string;
  subcategory: string;
  isLatest?: boolean;
  asOnDate?: Date;
  state?: string;
}

/** The `$search` stage: fuzzy name match, narrowed to the list being viewed. */
export function buildPlayerSearchPipeline(
  term: string,
  scope: PlayerSearchScope
): Record<string, unknown>[] {
  const query = term.trim().slice(0, MAX_TERM_LENGTH);
  const filter: Record<string, unknown>[] = [
    { equals: { path: "sportSlug", value: scope.sportSlug } },
    { equals: { path: "category", value: scope.category } },
    { equals: { path: "subcategory", value: scope.subcategory } },
  ];
  if (scope.isLatest !== undefined) {
    filter.push({ equals: { path: "isLatest", value: scope.isLatest } });
  }
  if (scope.asOnDate) filter.push({ equals: { path: "asOnDate", value: scope.asOnDate } });
  if (scope.state) filter.push({ equals: { path: "state", value: scope.state } });

  return [
    {
      $search: {
        index: RANKING_SEARCH_INDEX,
        compound: {
          should: [
            // Each word the parent has typed so far, as a prefix, one typo allowed.
            {
              autocomplete: {
                query,
                path: "fullName",
                fuzzy: { maxEdits: 1, prefixLength: 1 },
              },
            },
            // Whole words, one typo allowed ("sarma" -> "sharma").
            {
              text: {
                query,
                path: "fullName",
                fuzzy: { maxEdits: 1, prefixLength: 1 },
              },
            },
          ],
          minimumShouldMatch: 1,
          filter,
        },
      },
    },
    { $limit: MAX_MATCHES },
    { $project: { _id: 1 } },
  ];
}

/**
 * Ids of the entries whose name is close to `term`, or [] when Atlas Search is
 * off, unavailable, or slow. Never throws.
 */
export async function findSimilarPlayerIds(
  term: string,
  scope: PlayerSearchScope
): Promise<Types.ObjectId[]> {
  if (!atlasSearchEnabled() || Date.now() < skipUntil) return [];
  if (term.trim().length < 2) return [];

  try {
    const rows = await RankingEntry.aggregate<{ _id: Types.ObjectId }>(
      buildPlayerSearchPipeline(term, scope) as unknown as PipelineStage[]
    ).option({ maxTimeMS: MAX_TIME_MS });
    return rows.map((row) => row._id);
  } catch (error) {
    skipUntil = Date.now() + BACKOFF_MS;
    log.warn(
      `[ranking-search] Atlas Search unavailable, using regex only for ${BACKOFF_MS / 1000}s: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

/** Test seam: forget a recorded failure. */
export const resetAtlasBackoff = (): void => {
  skipUntil = 0;
};
