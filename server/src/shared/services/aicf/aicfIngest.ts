import { slugifyEditionName } from "../editionSlugText";
import type { AicfEventRow } from "./aicfEventsParser";

/**
 * Deciding what to store from AICF's "All Events" table. Pure, like the AITA
 * calendar plan (services/aita/calendarIngest.ts): rows read and editions
 * stored go in, the writes that would bring the store in line come out, so the
 * decisions are tested and shown as a report before anything is written.
 *
 * ── What it maintains ───────────────────────────────────────────────────────
 * Upcoming chess events only: anything that has not ended. A finished event is
 * history and its page already exists, or it does not, for its own reasons.
 *
 * ── Matching rows that are already stored ───────────────────────────────────
 *  1. A row carrying the same AICF event code (`externalId`) is the same event.
 *  2. Otherwise a chess row with no code, starting the same day, whose name is
 *     the same once punctuation is ignored or shares at least half its
 *     distinctive words. These are the rows the admin extraction made.
 *  3. Otherwise a row with no code within 45 days whose name is all but
 *     identical (score 0.95 or more): the same event, which AICF has since
 *     moved. Seen on 2026-11-14: "2nd Manchester City International Below 1800"
 *     stored for 21 Nov, listed by AICF for 27 Nov; the 63rd National
 *     Championship stored for 28 Dec, listed for 29 Nov.
 *
 * The passes run over every AICF row in turn (all code matches first, then all
 * same-day matches, then the moved ones), so a loose match can never take a
 * stored row that a stricter one would have claimed.
 *
 * A matched row keeps its name and slug, so indexed URLs keep working. AICF is
 * the authority for the code and the dates, so those are written over (on a
 * moved event that is the correction); everything else is only filled in when
 * empty, so nothing an admin wrote by hand is replaced.
 *
 * The admin extraction stored several events more than once (one row per
 * category and another for the whole festival, on 2026-11-14 about 20 of the 43
 * upcoming rows). Each AICF event claims at most one stored row, so no new
 * duplicate is made, and the unclaimed lookalikes are reported in
 * `possibleDuplicates` for a merge (migration 41 is how that was done before).
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 * It never cancels or deletes. AICF keeps finished events on the page and has
 * no history of withdrawing rows, so an event going missing is reported for a
 * human to look at, not acted on.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const AICF_EVENTS_URL = "https://aicf.in/all-events/";

const asDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

export interface StoredChessEdition {
  _id: unknown;
  name: string;
  slug?: string | null;
  startDate: Date;
  endDate?: Date | null;
  externalId?: string | null;
  federationSlug?: string | null;
  officialName?: string | null;
  city?: string | null;
  state?: string | null;
  level?: string | null;
  ageGroups?: string[] | null;
  documents?: Array<{ label: string; url: string; kind: string }> | null;
  status?: string | null;
}

export interface EditionDocumentWrite {
  label: string;
  url: string;
  kind: "factSheet";
}

export interface AicfCreateOp {
  eventCode: string;
  doc: {
    sportSlug: "chess";
    federationSlug: "aicf";
    name: string;
    slug: string;
    officialName: string;
    editionYear: number;
    startDate: Date;
    endDate: Date;
    city?: string;
    state?: string;
    level?: string;
    ageGroups: string[];
    externalId: string;
    documents?: EditionDocumentWrite[];
    sourceUrl: string;
    status: "announced" | "ongoing";
    lastCheckedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface AicfUpdateOp {
  eventCode: string;
  id: unknown;
  /** The stored name, which is kept. */
  name: string;
  /** `moved`: matched by an all-but-identical name on a different day, so the dates are corrected. */
  matchedBy: "eventCode" | "name" | "moved";
  /** Field names changed, for the report. `lastCheckedAt` and `updatedAt` are not listed. */
  changed: string[];
  set: Record<string, unknown>;
}

export interface AicfIngestPlan {
  creates: AicfCreateOp[];
  updates: AicfUpdateOp[];
  skipped: Array<{ eventCode: string; name: string; reason: string }>;
  /** Stored upcoming chess rows carrying an AICF code that the page no longer lists. Report only. */
  missing: StoredChessEdition[];
  /** Unclaimed stored rows that look like an event another row was matched to. Report only. */
  possibleDuplicates: Array<{
    stored: StoredChessEdition;
    likeEventCode: string;
    likeName: string;
  }>;
  /** Rows read that have already ended, so were not considered. */
  finished: number;
}

export interface AicfIngestInput {
  rows: AicfEventRow[];
  stored: StoredChessEdition[];
  takenSlugs: Set<string>;
  now: Date;
  /** Events starting further out than this are left for a later sweep. Default 400 days. */
  horizonDays?: number;
}

// ─── Reading the name ─────────────────────────────────────────────────────────

/**
 * The level the name claims. "International" in an Indian open means FIDE-rated
 * with foreign players allowed, which is what the field already holds for the
 * extracted rows, so the same words are used.
 */
export function levelFromName(name: string): string | undefined {
  if (/\binternational\b/i.test(name)) return "International";
  if (/\bnational\b/i.test(name)) return "National";
  if (/\bstate\b/i.test(name)) return "State";
  if (/\bdistrict\b/i.test(name)) return "District";
  return undefined;
}

/**
 * Who may enter, as far as the name says: rating caps ("Below 1700") and age
 * groups ("Under-11", "U-9"). Nothing is inferred from "Open": in Indian chess
 * it usually means open to all, but not always, so it is left unsaid.
 */
export function ageGroupsFromName(name: string): string[] {
  const groups = new Set<string>();
  for (const m of name.matchAll(/\b(?:below|under|u)[\s-]*(\d{4})\b/gi)) {
    groups.add(`Below ${m[1]}`);
  }
  for (const m of name.matchAll(/\b(?:under|u)[\s-]*(\d{1,2})\b(?!\d)/gi)) {
    const age = Number(m[1]);
    if (age >= 5 && age <= 25) groups.add(`Under-${age}`);
  }
  return [...groups];
}

const STOP_WORDS = new Set([
  "chess",
  "tournament",
  "championship",
  "championships",
  "the",
  "and",
  "for",
  "fide",
  "rated",
  "rating",
  "international",
  "open",
  "all",
  "india",
  "memorial",
]);

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function words(name: string): Set<string> {
  return new Set(
    (name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (w) => w.length > 2 && !STOP_WORDS.has(w) && !/^20\d\d$/.test(w)
    )
  );
}

/** 1 for the same name, otherwise the share of the shorter name's distinctive words found in the other. */
export function nameSimilarity(a: string, b: string): number {
  if (squash(a) === squash(b)) return 1;
  const wa = words(a);
  const wb = words(b);
  const smaller = Math.min(wa.size, wb.size);
  if (smaller === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return (shared / smaller) * 0.99;
}

const MIN_SIMILARITY = 0.5;
/** A different day needs a near-identical name: annual events share names a year apart. */
const MOVED_MIN_SIMILARITY = 0.95;
const MOVED_WINDOW_DAYS = 45;

// ─── The plan ─────────────────────────────────────────────────────────────────

const keyOf = (name: string, start: Date): string => `${name}|${start.toISOString()}`;

function brochureDoc(url: string): EditionDocumentWrite {
  return { label: "Brochure", url, kind: "factSheet" };
}

export function planAicfIngest(input: AicfIngestInput): AicfIngestPlan {
  const plan: AicfIngestPlan = {
    creates: [],
    updates: [],
    skipped: [],
    missing: [],
    possibleDuplicates: [],
    finished: 0,
  };
  const today = isoDay(input.now);
  const horizon = isoDay(new Date(input.now.getTime() + (input.horizonDays ?? 400) * DAY_MS));

  // One row per event code. AICF occasionally lists a code twice; the first wins
  // and a second that disagrees on dates is reported, since one of them is wrong.
  const byCode = new Map<string, AicfEventRow>();
  for (const row of input.rows) {
    const seen = byCode.get(row.eventCode);
    if (!seen) {
      byCode.set(row.eventCode, row);
    } else if (seen.startDate !== row.startDate || seen.endDate !== row.endDate) {
      plan.skipped.push({
        eventCode: row.eventCode,
        name: row.name,
        reason: `code listed twice with different dates (${seen.startDate} and ${row.startDate}); kept the first`,
      });
    }
  }

  const rows = [...byCode.values()].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.eventCode.localeCompare(b.eventCode)
  );

  const finalKeys = new Map<string, unknown>();
  for (const s of input.stored) finalKeys.set(keyOf(s.name, s.startDate), s._id);

  // ── Which rows are this sweep's business ──────────────────────────────
  const live: AicfEventRow[] = [];
  for (const row of rows) {
    if (row.endDate < today) {
      plan.finished += 1;
    } else if (row.startDate > horizon) {
      plan.skipped.push({
        eventCode: row.eventCode,
        name: row.name,
        reason: `starts ${row.startDate}, more than ${input.horizonDays ?? 400} days out; likely a typo`,
      });
    } else {
      live.push(row);
    }
  }

  // ── Matching, strictest pass first across every row ───────────────────
  const claimed = new Set<unknown>();
  const matches = new Map<
    string,
    { hit: StoredChessEdition; matchedBy: AicfUpdateOp["matchedBy"] }
  >();
  const nameOf = (s: StoredChessEdition): string => s.officialName || s.name;
  const claim = (
    row: AicfEventRow,
    hit: StoredChessEdition | undefined,
    by: AicfUpdateOp["matchedBy"]
  ) => {
    if (!hit) return;
    claimed.add(hit._id);
    matches.set(row.eventCode, { hit, matchedBy: by });
  };

  for (const row of live) {
    claim(
      row,
      input.stored.find((s) => !claimed.has(s._id) && s.externalId === row.eventCode),
      "eventCode"
    );
  }
  for (const row of live) {
    if (matches.has(row.eventCode)) continue;
    const best = input.stored
      .filter((s) => !claimed.has(s._id) && !s.externalId && isoDay(s.startDate) === row.startDate)
      .map((s) => ({ s, score: nameSimilarity(nameOf(s), row.name) }))
      .filter((c) => c.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)[0];
    claim(row, best?.s, "name");
  }
  for (const row of live) {
    if (matches.has(row.eventCode)) continue;
    const at = asDate(row.startDate).getTime();
    const best = input.stored
      .filter(
        (s) =>
          !claimed.has(s._id) &&
          !s.externalId &&
          Math.abs(s.startDate.getTime() - at) <= MOVED_WINDOW_DAYS * DAY_MS
      )
      .map((s) => ({
        s,
        score: nameSimilarity(nameOf(s), row.name),
        distance: Math.abs(s.startDate.getTime() - at),
      }))
      .filter((c) => c.score >= MOVED_MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score || a.distance - b.distance)[0];
    claim(row, best?.s, "moved");
  }

  for (const row of live) {
    const start = asDate(row.startDate);
    const end = asDate(row.endDate);
    const match = matches.get(row.eventCode);
    const hit = match?.hit;
    const matchedBy = match?.matchedBy ?? "name";

    if (hit) {
      const set: Record<string, unknown> = {};
      const changed: string[] = [];
      const put = (field: string, value: unknown): void => {
        set[field] = value;
        changed.push(field);
      };

      if (hit.externalId !== row.eventCode) put("externalId", row.eventCode);
      if (hit.federationSlug !== "aicf") put("federationSlug", "aicf");
      if (!hit.officialName) put("officialName", row.name);

      // Dates are AICF's. A same-day name match cannot differ on the start, so its
      // end is only filled when missing; a code match or a moved event takes AICF's.
      const datesAreAicfs = matchedBy === "eventCode" || matchedBy === "moved";
      if (datesAreAicfs && isoDay(hit.startDate) !== row.startDate) {
        const newKey = keyOf(hit.name, start);
        const owner = finalKeys.get(newKey);
        if (owner !== undefined && owner !== hit._id) {
          plan.skipped.push({
            eventCode: row.eventCode,
            name: row.name,
            reason: `moving "${hit.name}" to ${row.startDate} would collide with another stored row`,
          });
          continue;
        }
        finalKeys.delete(keyOf(hit.name, hit.startDate));
        finalKeys.set(newKey, hit._id);
        put("startDate", start);
        put("editionYear", start.getUTCFullYear());
      }
      if (
        (!hit.endDate && row.endDate) ||
        (datesAreAicfs && hit.endDate && isoDay(hit.endDate) !== row.endDate)
      ) {
        put("endDate", end);
      }

      if (!hit.city && row.city) put("city", row.city);
      if (!hit.state && row.state) put("state", row.state);
      if (!hit.level) {
        const level = levelFromName(row.name);
        if (level) put("level", level);
      }
      if (!hit.ageGroups || hit.ageGroups.length === 0) {
        const groups = ageGroupsFromName(row.name);
        if (groups.length > 0) put("ageGroups", groups);
      }
      if (row.brochureUrl && !(hit.documents ?? []).some((d) => d.url === row.brochureUrl)) {
        put("documents", [...(hit.documents ?? []), brochureDoc(row.brochureUrl)]);
      }

      set.lastCheckedAt = input.now;
      if (changed.length > 0) set.updatedAt = input.now;
      plan.updates.push({
        eventCode: row.eventCode,
        id: hit._id,
        name: hit.name,
        matchedBy,
        changed,
        set,
      });
      continue;
    }

    // ── A new row ────────────────────────────────────────────────────────
    let name = row.name;
    if (finalKeys.has(keyOf(name, start))) name = `${row.name} (${row.eventCode})`;
    if (finalKeys.has(keyOf(name, start))) {
      plan.skipped.push({
        eventCode: row.eventCode,
        name: row.name,
        reason: "a stored row already has this name and start date",
      });
      continue;
    }
    finalKeys.set(keyOf(name, start), "new");

    const slugBase = `${slugifyEditionName(name)}-${row.startDate}`.replace(/^-/, "");
    let slug = slugBase;
    for (let n = 2; input.takenSlugs.has(slug); n += 1) slug = `${slugBase}-${n}`;
    input.takenSlugs.add(slug);

    const level = levelFromName(row.name);
    plan.creates.push({
      eventCode: row.eventCode,
      doc: {
        sportSlug: "chess",
        federationSlug: "aicf",
        name,
        slug,
        officialName: row.name,
        editionYear: start.getUTCFullYear(),
        startDate: start,
        endDate: end,
        ...(row.city ? { city: row.city } : {}),
        ...(row.state ? { state: row.state } : {}),
        ...(level ? { level } : {}),
        ageGroups: ageGroupsFromName(row.name),
        externalId: row.eventCode,
        ...(row.brochureUrl ? { documents: [brochureDoc(row.brochureUrl)] } : {}),
        sourceUrl: AICF_EVENTS_URL,
        status: row.startDate <= today ? "ongoing" : "announced",
        lastCheckedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      },
    });
  }

  const seen = new Set(byCode.keys());
  plan.missing = input.stored.filter(
    (s) =>
      !!s.externalId &&
      !seen.has(s.externalId) &&
      s.status !== "cancelled" &&
      isoDay(s.startDate) >= today
  );

  // Stored rows nothing claimed that start the same day as a matched AICF event
  // and read like it: the extraction's leftovers (a festival row beside its
  // category rows, or one event stored under two names).
  for (const s of input.stored) {
    // No date filter of its own: only live (unfinished) AICF events are compared,
    // and an event that started yesterday and is still running counts.
    if (claimed.has(s._id) || s.externalId) continue;
    const like = live
      .filter((row) => matches.has(row.eventCode) && row.startDate === isoDay(s.startDate))
      .map((row) => ({ row, score: nameSimilarity(nameOf(s), row.name) }))
      .filter((c) => c.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)[0];
    if (like) {
      plan.possibleDuplicates.push({
        stored: s,
        likeEventCode: like.row.eventCode,
        likeName: like.row.name,
      });
    }
  }
  return plan;
}
