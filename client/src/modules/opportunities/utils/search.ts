import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";

import type { Opportunity } from "../services/opportunities";

/**
 * Does this entry match what was typed in the search box?
 *
 * Every word typed must appear somewhere in the entry's name, summary, owner,
 * sports, state, benefit or type, in any order, so "tennis iit" finds the IIT
 * entry that lists tennis. Case-insensitive. An empty box matches everything.
 */
export function matchesQuery(
  item: Opportunity,
  query: string,
  categoryLabel: string | undefined
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [
    item.title,
    item.summary,
    item.owner?.name,
    item.benefit?.summary,
    item.geography?.state,
    categoryLabel,
    ...item.sports.map((slug) => SPORT_LABEL[slug] ?? slug),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}
