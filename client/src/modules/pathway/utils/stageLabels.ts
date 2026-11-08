// ─── Stage labels for the /roadmap sport cards: pure helpers ───────────────
//
// Stage names and age ranges are free text in the CMS ("Discover Tennis",
// "Age 4–7", "~5-8"). These turn them into the short forms a card has room
// for, kept pure so the tests can run them over data the page cannot show yet.

import type { PathwayStageSummary } from "../services/pathway";

/** "Discover Tennis" -> "Discover". Stage names often repeat the sport; the row already says it. */
export function shortStageName(name: string, sportName: string): string {
  const escaped = sportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = name.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "").replace(/\s{2,}/g, " ");
  return stripped.trim() || name.trim();
}

/** "Age 4–7" -> "4–7", "~5-8" -> "~5–8", "18+" -> "18+". The column already says these are ages. */
export function compactAgeRange(raw: string): string {
  return raw
    .replace(/^\s*ages?\s*/i, "")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1–$2")
    .trim();
}

/** "Ages 4 to 18+" from a sport's first and last stage, or null when it cannot be read. */
export function ageSpan(stages: Array<Pick<PathwayStageSummary, "ageRange">>): string | null {
  if (stages.length === 0) return null;
  const first = compactAgeRange(stages[0].ageRange).split("–")[0]?.trim();
  const lastRange = compactAgeRange(stages[stages.length - 1].ageRange);
  const last = lastRange.includes("–") ? lastRange.split("–")[1]?.trim() : lastRange;
  if (!first || !last) return null;
  return first === last ? `Age ${first}` : `Ages ${first} to ${last}`;
}

/** "an 11-year-old", "an 8-year-old", "a 9-year-old". */
export const ageArticle = (age: number): "a" | "an" =>
  age === 8 || age === 11 || age === 18 || (age >= 80 && age < 90) ? "an" : "a";

/** `/roadmap/tennis?stage=compete`: the reader renders that stage server-side. */
export const stageHref = (slug: string, key?: string) =>
  key ? `/roadmap/${slug}?stage=${encodeURIComponent(key)}` : `/roadmap/${slug}`;
