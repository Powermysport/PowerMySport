import { discriminators } from "../editionDiscriminators";
import { nameSimilarity } from "./aicfIngest";

/**
 * Which stored chess rows are duplicates of an event AICF lists, and which row
 * each one should redirect to. Pure: rows in, decisions out. Used by migration 74.
 *
 * ── Why this is safer than migration 41 ─────────────────────────────────────
 * Migration 41 had to guess which of two look-alike rows was the real event.
 * Since the AICF sync, every upcoming chess event AICF lists has exactly one
 * stored row carrying its FIDE event code (`externalId`). That row is the
 * survivor, always: it is the one the daily sync keeps current. What remains
 * is only to decide whether a code-less row on the same day is that event.
 *
 * ── The rules ───────────────────────────────────────────────────────────────
 * A code-less ("legacy") row is merged into a coded row only when all hold:
 *  1. Its source is AICF's own site. Every real event from that source has a
 *     code today, so a code-less one beside a coded twin is a leftover. A row
 *     from anywhere else might be an event AICF does not list, and is left alone.
 *  2. Same start day as the coded row.
 *  3. Names share at least half their distinctive words (the sync's own test).
 *  4. Qualifiers agree, as in migration 41: same category letter, rating band,
 *     age group, format and division. "Cat A above 2000" never merges into
 *     "Cat B below 2000".
 *  5. Exactly one coded row passes 1 to 4. Two equally good targets means the
 *     row is ambiguous, and it is reported for a person, not guessed.
 *
 * One exception to rule 4: a row naming FEWER qualifiers than a coded row (the
 * festival "…Grandmaster Open Chess Tournament (Coimbatore)" beside its
 * categories, or "2nd Maharathi International Below 1800 Delhi" beside AICF's
 * "…BELOW 1800 CLASSICAL…") is merged when exactly one coded row that day has all
 * of its qualifiers. It is then the only event it can mean. With two or more,
 * it is reported as ambiguous. A row naming a qualifier the coded row lacks is
 * never merged: it describes something more specific than that event.
 *
 * Merges are redirects, not deletions: the loser gains `mergedInto` and its URL
 * answers with a permanent redirect, so search equity moves to the survivor.
 */

export interface ChessRow {
  _id: unknown;
  slug?: string | null;
  name: string;
  officialName?: string | null;
  startDate: Date;
  externalId?: string | null;
  sourceUrl?: string | null;
  mergedInto?: string | null;
  venue?: string | null;
  organiser?: string | null;
  detailUrl?: string | null;
  registrationDeadlineDate?: Date | null;
  documents?: Array<{ label: string; url: string; kind: string }> | null;
}

export interface ChessMerge {
  loser: ChessRow;
  survivor: ChessRow;
  /** Why it matched, for the report. */
  reason: string;
}

export interface ChessMergePlan {
  merges: ChessMerge[];
  /** Fields a survivor lacks that a loser has, copied across. Keyed by survivor slug. */
  fills: Map<string, { survivor: ChessRow; set: Record<string, unknown>; changed: string[] }>;
  ambiguous: Array<{ row: ChessRow; candidates: ChessRow[]; reason: string }>;
}

const MIN_SIMILARITY = 0.5;

const dayOf = (d: Date): string => new Date(d).toISOString().slice(0, 10);
const nameOf = (r: ChessRow): string => r.officialName || r.name;

function fromAicf(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "aicf.in" || host.endsWith(".aicf.in");
  } catch {
    return false;
  }
}

function isSubset(small: Set<string>, big: Set<string>): boolean {
  for (const v of small) if (!big.has(v)) return false;
  return true;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function planChessDuplicateMerges(rows: ChessRow[]): ChessMergePlan {
  const plan: ChessMergePlan = { merges: [], fills: new Map(), ambiguous: [] };
  const live = rows.filter((r) => !r.mergedInto);
  const codedByDay = new Map<string, ChessRow[]>();
  for (const r of live) {
    if (!r.externalId || !r.slug) continue;
    const day = dayOf(r.startDate);
    codedByDay.set(day, [...(codedByDay.get(day) ?? []), r]);
  }

  for (const row of live) {
    if (row.externalId || !fromAicf(row.sourceUrl)) continue;
    const sameDay = codedByDay.get(dayOf(row.startDate)) ?? [];
    const similar = sameDay.filter((c) => nameSimilarity(nameOf(row), nameOf(c)) >= MIN_SIMILARITY);
    if (similar.length === 0) continue;

    const mine = discriminators(nameOf(row));
    const qualified = similar.filter((c) => sameSet(mine, discriminators(nameOf(c))));

    let survivor: ChessRow | undefined;
    let reason = "";
    if (qualified.length === 1) {
      survivor = qualified[0];
      reason =
        mine.size > 0 ? `same day, same qualifiers (${[...mine].join(", ")})` : "same day and name";
    } else if (qualified.length > 1) {
      plan.ambiguous.push({
        row,
        candidates: qualified,
        reason: "several coded events with the same qualifiers that day",
      });
      continue;
    } else {
      // Fewer qualifiers than a coded row (the festival naming no category, or a
      // short name dropping "Classical"): it can only mean an event whose
      // qualifiers include all of its own, and only when exactly one does.
      const supersets = similar.filter((c) => isSubset(mine, discriminators(nameOf(c))));
      if (supersets.length === 1) {
        survivor = supersets[0];
        reason =
          mine.size === 0
            ? "names no qualifier, and is the only event of this name that day"
            : `names fewer qualifiers (${[...mine].join(", ")}), and is the only event they fit that day`;
      } else if (supersets.length > 1) {
        plan.ambiguous.push({
          row,
          candidates: supersets,
          reason:
            mine.size === 0
              ? "names no qualifier, and that day has several events of this name"
              : "names fewer qualifiers, and several events that day fit them",
        });
        continue;
      } else {
        // Its qualifiers fit none of the coded rows: a different section, or one
        // AICF has not listed. Either way it is not a duplicate.
        continue;
      }
    }
    if (!survivor) continue;

    plan.merges.push({ loser: row, survivor, reason });

    // Carry over anything the survivor is missing, so a merge never loses a fact.
    const key = survivor.slug!;
    const entry = plan.fills.get(key) ?? { survivor, set: {}, changed: [] };
    const has = (field: keyof ChessRow): boolean =>
      entry.set[field] !== undefined ||
      (survivor[field] !== undefined && survivor[field] !== null && survivor[field] !== "");
    for (const field of ["venue", "organiser", "detailUrl", "registrationDeadlineDate"] as const) {
      if (!has(field) && row[field]) {
        entry.set[field] = row[field];
        entry.changed.push(field);
      }
    }
    const docs = (entry.set.documents as ChessRow["documents"]) ?? survivor.documents ?? [];
    const extra = (row.documents ?? []).filter((d) => !docs.some((x) => x.url === d.url));
    if (extra.length > 0) {
      entry.set.documents = [...docs, ...extra];
      if (!entry.changed.includes("documents")) entry.changed.push("documents");
    }
    plan.fills.set(key, entry);
  }

  for (const [key, entry] of plan.fills) if (entry.changed.length === 0) plan.fills.delete(key);
  return plan;
}
