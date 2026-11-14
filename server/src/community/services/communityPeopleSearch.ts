import type { PipelineStage, Types } from "mongoose";

import { User } from "../../client/models/User";
import { tryAtlasSearch } from "../../shared/services/atlasSearch";

// ─── Finding parents by name without scanning every user ────────────────────
//
// `User.find({ name: /term/i })` cannot use an index: an unanchored, case
// insensitive pattern makes MongoDB read every user, on every debounced
// keystroke, and a query that matches nothing reads all of them. That is the one
// community search whose cost grows with the whole site rather than with a list.
//
// With Atlas Search switched on (ATLAS_SEARCH_ENABLED=true, after the
// `user_name_search` index exists: see ATLAS_SEARCH.md beside this file) a name is
// answered from the search index instead: each word typed so far as a prefix,
// one typo allowed. Without it, or if it fails, the caller uses the plain query
// it always had, now capped in time (see NAME_SCAN_MS in communityProfileService).
//
// One deliberate difference: Atlas matches the START of a word ("rao" finds
// "Vikram Rao"); the old regex also matched the middle of one ("ikram" found
// "Vikram"). Nobody types the middle of a name.

export const USER_SEARCH_INDEX = "user_name_search";
const MAX_TERM_LENGTH = 100;
/** Autocomplete is indexed from two letters, so a single letter cannot use it. */
const MIN_TERM_LENGTH = 2;

/** The `$search` stage: fuzzy name match, narrowed to the roles that may be found. */
export function buildPeopleSearchPipeline(
  term: string,
  roles: readonly string[],
  limit: number
): Record<string, unknown>[] {
  const query = term.trim().slice(0, MAX_TERM_LENGTH);
  return [
    {
      $search: {
        index: USER_SEARCH_INDEX,
        compound: {
          should: [
            // Each word typed so far, as a prefix, one typo allowed.
            { autocomplete: { query, path: "name", fuzzy: { maxEdits: 1, prefixLength: 1 } } },
            // Whole words, one typo allowed ("rahool" -> "rahul").
            { text: { query, path: "name", fuzzy: { maxEdits: 1, prefixLength: 1 } } },
          ],
          minimumShouldMatch: 1,
          filter: [{ in: { path: "role", value: [...roles] } }],
        },
      },
    },
    { $limit: limit },
    { $project: { _id: 1 } },
  ];
}

/**
 * Ids of the users whose name matches `term`, from Atlas Search, or null when the
 * caller should run its plain query (search off, the term too short, or the index
 * unavailable). An empty array is an answer, not a failure: nobody matched.
 */
export async function findUserIdsByName(
  term: string,
  roles: readonly string[],
  limit: number
): Promise<Types.ObjectId[] | null> {
  if (term.trim().length < MIN_TERM_LENGTH) return null;

  const rows = await tryAtlasSearch("users", () =>
    User.aggregate<{ _id: Types.ObjectId }>(
      buildPeopleSearchPipeline(term, roles, limit) as unknown as PipelineStage[]
    ).option({ maxTimeMS: 1500 })
  );
  return rows ? rows.map((row) => row._id) : null;
}
