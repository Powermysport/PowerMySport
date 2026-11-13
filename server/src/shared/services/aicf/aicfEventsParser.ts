import { INDIAN_STATES_AND_UTS, type IndianStateOrUT } from "../../utils/states";

/**
 * Reads AICF's "All Events" page (https://aicf.in/all-events/) into rows.
 *
 * The page is one WordPress table, one row per event AICF has registered:
 * name, FIDE event code, start date, end date, place, and a brochure link.
 * Pure: HTML in, rows out, so it is tested against a saved copy of the page.
 *
 * ── Why the event code matters ──────────────────────────────────────────────
 * It is the code FIDE registers the event under, so it is a stable key that
 * survives AICF renaming a row, and it is the join to FIDE's own tournament
 * pages later. Rows are matched on it, never on the name alone.
 *
 * ── What the page gets wrong, and what this does about it ───────────────────
 * Observed on 2026-11-14: an end date before its start (23-07-2027 to
 * 26-07-2026), names padded with &nbsp;, a "Download" link split across two
 * anchors, and a place that is sometimes a city, sometimes a state, sometimes
 * "City,<br>State". A row whose dates cannot be trusted is rejected with a
 * reason rather than guessed at: a wrong date on an event page is worse than
 * the event missing for a day.
 */

export interface AicfEventRow {
  /** FIDE event code as AICF prints it. */
  eventCode: string;
  name: string;
  /** `YYYY-MM-DD` */
  startDate: string;
  /** `YYYY-MM-DD`, never before `startDate`. */
  endDate: string;
  /** The place cell as printed, line breaks turned into commas. */
  placeText: string;
  city?: string;
  state?: IndianStateOrUT;
  brochureUrl?: string;
}

export interface AicfRejectedRow {
  name: string;
  eventCode: string;
  reason: string;
}

export interface AicfEventsPage {
  rows: AicfEventRow[];
  rejected: AicfRejectedRow[];
}

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Cell HTML to plain text: `<br>` becomes a comma, other tags vanish, spaces collapse. */
function cellText(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ", ").replace(/<[^>]+>/g, ""))
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,(\s*,)+/g, ",")
    .trim()
    .replace(/^,|,$/g, "")
    .trim();
}

/** `dd-mm-yyyy` to `YYYY-MM-DD`, or null when it is not a real calendar day. */
export function parseAicfDate(value: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

const STATE_BY_KEY = new Map<string, IndianStateOrUT>(
  INDIAN_STATES_AND_UTS.map((s) => [s.toLowerCase().replace(/[^a-z]/g, ""), s])
);

/** Spellings AICF uses that are not the canonical name. */
const STATE_ALIASES: Record<string, IndianStateOrUT> = {
  up: "Uttar Pradesh",
  mp: "Madhya Pradesh",
  wb: "West Bengal",
  tn: "Tamil Nadu",
  tamilnadu: "Tamil Nadu",
  ap: "Andhra Pradesh",
  orissa: "Odisha",
  pondicherry: "Puducherry",
  pondy: "Puducherry",
  newdelhi: "Delhi",
  cg: "Chhattisgarh",
  jk: "Jammu and Kashmir",
  jammukashmir: "Jammu and Kashmir",
};

export function resolveState(text: string): IndianStateOrUT | undefined {
  const key = text.toLowerCase().replace(/[^a-z]/g, "");
  if (!key) return undefined;
  return STATE_BY_KEY.get(key) ?? STATE_ALIASES[key];
}

/**
 * "Pune, Maharashtra" -> city Pune, state Maharashtra. "Tamil Nadu" -> state only.
 * "Chennai" -> city only. Only a part that is a known state becomes `state`;
 * everything else is the city, so an unknown place is kept as printed, not dropped.
 */
export function splitPlace(placeText: string): { city?: string; state?: IndianStateOrUT } {
  const parts = placeText
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};
  const last = parts[parts.length - 1]!;
  const state = resolveState(last);
  if (state) {
    const city = parts.slice(0, -1).join(", ");
    // "Delhi" as the whole cell is a city and a state at once.
    if (!city && state === "Delhi") return { city: "Delhi", state };
    return city ? { city, state } : { state };
  }
  return { city: parts.join(", ") };
}

function firstHref(html: string): string | undefined {
  const m = /href\s*=\s*"([^"]+)"/i.exec(html) ?? /href\s*=\s*'([^']+)'/i.exec(html);
  if (!m) return undefined;
  const url = decodeEntities(m[1]!).trim();
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every event row on the page. Rows without six cells (the header, layout rows)
 * are not events and are skipped silently; a row that is an event but cannot be
 * trusted is returned in `rejected` with the reason.
 */
export function parseAicfEventsPage(html: string): AicfEventsPage {
  const out: AicfEventsPage = { rows: [], rejected: [] };
  for (const tr of html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (cells.length < 5) continue;

    const name = cellText(cells[0]!);
    const codeText = cellText(cells[1]!);
    const eventCode = /\d{5,8}/.exec(codeText)?.[0] ?? "";
    if (!name && !eventCode) continue;

    const reject = (reason: string): void => {
      out.rejected.push({ name, eventCode, reason });
    };
    if (!name) {
      reject("no name");
      continue;
    }
    if (!eventCode) {
      reject(`no event code (cell says "${codeText}")`);
      continue;
    }
    const startDate = parseAicfDate(cellText(cells[2]!));
    const endDate = parseAicfDate(cellText(cells[3]!)) ?? startDate;
    if (!startDate || !endDate) {
      reject(`unreadable start date "${cellText(cells[2]!)}"`);
      continue;
    }
    if (endDate < startDate) {
      reject(`ends ${endDate}, before it starts ${startDate}`);
      continue;
    }

    const placeText = cellText(cells[4]!);
    const brochureUrl = cells[5] ? firstHref(cells[5]) : undefined;
    out.rows.push({
      eventCode,
      name,
      startDate,
      endDate,
      placeText,
      ...splitPlace(placeText),
      ...(brochureUrl ? { brochureUrl } : {}),
    });
  }
  return out;
}
