/**
 * The qualifiers that split one chess festival into separately entered events
 * (category letter, rating band, age group, format, division), read from an
 * edition's name.
 *
 * Moved verbatim out of migration 41 so the AICF duplicate merge (migration 74)
 * applies exactly the same guard: two rows are only ever the same event when
 * these sets are equal. Pure and model-free, so importing it never touches the
 * database.
 */

/**
 * Qualifiers that split one festival into several separately-entered events.
 *
 * These are compared for EXACT equality before two rows are considered the same
 * event, and this is the guard that does the real work. A first attempt matched
 * on word-subset alone with "chess"/"tournament" treated as noise, which made
 * "Athens of the East 6th International Grandmaster Open Chess Tournament" a
 * subset of "…Open Cat D Below 1800" and proposed merging a category into the
 * umbrella listing. They run on the same day under near-identical names and are
 * different competitions with different entry fees and draws.
 */
export const FORMATS = new Set(["blitz", "rapid", "classical", "bullet"]);
export const DIVISIONS = new Set([
  "junior",
  "juniors",
  "senior",
  "seniors",
  "subjunior",
  "boys",
  "girls",
  "men",
  "mens",
  "women",
  "womens",
  "masters",
  "challengers",
  "veterans",
  "team",
  "teams",
  "mixed",
  "gm",
  "im",
  "wgm",
  "wim",
]);
export const PLURAL: Record<string, string> = {
  juniors: "junior",
  seniors: "senior",
  teams: "team",
  mens: "men",
  womens: "women",
};

export function discriminators(name: string): Set<string> {
  const text = (name || "").toLowerCase();
  const out = new Set<string>();

  // "Cat B", "Cat-E", "(Category - A Above 2100)", "(Category ‘C’)" (AICF uses curly quotes)
  for (const m of text.matchAll(/\bcat(?:egory)?\b[\s\-'"‘’“”]*([a-e])\b/g)) out.add(`cat${m[1]}`);
  // Rating bands are 3-4 digits ("below 1700"); 1-2 digits is an age group.
  for (const m of text.matchAll(/\b(below|above|under)\s*-?\s*(\d{3,4})\b/g))
    out.add(`${m[1] === "under" ? "below" : m[1]}${m[2]}`);
  // Age groups: "U-14", "Under 14".
  for (const m of text.matchAll(/\b(?:u|under)\s*-?\s*(\d{1,2})\b/g)) out.add(`u${m[1]}`);

  for (const raw of text.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    const w = PLURAL[raw] ?? raw;
    if (FORMATS.has(w) || DIVISIONS.has(w)) out.add(w);
  }
  return out;
}
