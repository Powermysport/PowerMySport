import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";

import type { Opportunity } from "../services/opportunities";

/** "2026-07-30" -> "30 Jul 2026". Stored dates carry no time zone, so none is applied. */
export function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const PERIOD: Record<string, string> = {
  "one-time": "",
  month: " a month",
  year: " a year",
  total: " in total",
};

/** Notes that qualify the figure itself, so they read in front of it: "Up to $50,000". */
const LEADING_QUALIFIER =
  /^(up ?to|upto|from|about|around|approx\.?|approximately|at least|starting at)$/i;

/**
 * The amount and the editor's note, kept apart so a card can show the figure
 * large and the note small. A qualifier such as "Up to" joins the figure
 * ("Up to $50,000 a year"); any other note ("for one year", or a full sentence)
 * is returned as `note`, never glued on in front with a colon.
 */
export function amountParts(
  amount: NonNullable<Opportunity["benefit"]>["amount"]
): { money: string; note: string | null } | null {
  if (!amount) return null;
  const figure = new Intl.NumberFormat(amount.currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: amount.currency,
    maximumFractionDigits: 0,
  }).format(amount.value);
  const money = `${figure}${PERIOD[amount.period] ?? ""}`;
  const note = amount.note?.trim().replace(/[\s:.,;]+$/, "") || null;
  if (note && LEADING_QUALIFIER.test(note)) {
    const lead = note.charAt(0).toUpperCase() + note.slice(1);
    return { money: `${lead} ${money}`, note: null };
  }
  return { money, note };
}

/** "₹6,28,000 a year", or "₹40,000 a month (for one year)", in one line. */
export function formatAmount(amount: NonNullable<Opportunity["benefit"]>["amount"]): string | null {
  const parts = amountParts(amount);
  if (!parts) return null;
  return parts.note ? `${parts.money} (${parts.note})` : parts.money;
}

/**
 * What it costs, in a line: "Free. Girls and underprivileged children", "₹125.
 * City round", "Varies. By city". Null when the entry does not say, so the page
 * leaves the row out rather than implying it is free.
 */
export function costLine(cost: Opportunity["cost"]): string | null {
  if (!cost) return null;
  const note = cost.note?.trim();
  let head: string;
  if (cost.kind === "free") head = "Free";
  else if (cost.kind === "fee" && cost.amount !== undefined && cost.currency) {
    head = new Intl.NumberFormat(cost.currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: cost.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cost.amount);
  } else head = "Varies";
  // A "varies" with nothing to say what it varies on says only that, and the
  // official page is the answer.
  if (!note) return head === "Varies" ? "Varies. See the official website." : head;
  return `${head}. ${note}`;
}

/** "All sports", or the named sports. */
export function sportsLabel(opportunity: Pick<Opportunity, "allSports" | "sports">): string {
  if (opportunity.allSports) return "All sports";
  return opportunity.sports.map((slug) => SPORT_LABEL[slug] ?? slug).join(", ");
}

export function whereLabel(geography: Opportunity["geography"]): string | null {
  if (!geography) return null;
  switch (geography.scope) {
    case "state":
      return geography.state ? `${geography.state} only` : "One state";
    case "india":
      return "Across India";
    case "international":
      return "International";
    case "abroad":
      return "Abroad";
    default:
      return null;
  }
}

/** One line on where this cycle's window stands. */
export function cycleLine(opportunity: Pick<Opportunity, "cycle" | "cycleState">): string | null {
  const { cycle, cycleState } = opportunity;
  const label = cycle?.label ? `${cycle.label} ` : "";
  switch (cycleState) {
    case "open":
      return cycle?.closesOn ? `Open now. Closes on ${formatDay(cycle.closesOn)}` : "Open now";
    case "upcoming":
      return cycle?.opensOn ? `Opens on ${formatDay(cycle.opensOn)}` : "Opening soon";
    case "closed":
      return `Applications ${label ? `for ${label}` : ""}closed${cycle?.closesOn ? ` on ${formatDay(cycle.closesOn)}` : ""}. The next dates are not out yet.`;
    default:
      return null;
  }
}

/** A phrase cut at a word boundary, with an ellipsis when something was left out. */
function shorten(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[s.,;:-]+$/, "")}…`;
}

/**
 * Who an entry is for, as short chips for a card: the age rule and any gender
 * restriction. Rules written in sentences (marks, income, level) stay on the
 * entry's own page, where there is room to read them properly.
 */
export function eligibilityChips(eligibility: Opportunity["eligibility"]): string[] {
  if (!eligibility) return [];
  const chips: string[] = [];
  const { ageMin, ageMax, ageNote, gender } = eligibility;
  if (ageMin !== undefined && ageMax !== undefined) chips.push(`Ages ${ageMin} to ${ageMax}`);
  else if (ageMax !== undefined) chips.push(`Up to age ${ageMax}`);
  else if (ageMin !== undefined) chips.push(`Age ${ageMin} and over`);
  else if (ageNote) chips.push(shorten(ageNote, 30));
  if (gender === "female") chips.push("Girls and women only");
  if (gender === "male") chips.push("Boys and men only");
  return chips;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from `today` to `day` (both "YYYY-MM-DD"), or null when either is
 * not a date or `day` has passed. Calendar days, so there is no time zone in it.
 */
export function daysUntil(day: string, today: string): number | null {
  const target = Date.parse(`${day}T00:00:00Z`);
  const from = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(from)) return null;
  const days = Math.round((target - from) / MS_PER_DAY);
  return days < 0 ? null : days;
}

/**
 * The deadline line for a card: when the window closes and how long is left,
 * flagged `urgent` inside two weeks. Null when there is no window to speak of.
 */
export function deadlineLine(
  opportunity: Pick<Opportunity, "cycle" | "cycleState">,
  today: string
): { text: string; urgent: boolean } | null {
  const { cycle, cycleState } = opportunity;
  if (cycleState === "open" && cycle?.closesOn) {
    const left = daysUntil(cycle.closesOn, today);
    const when = `Closes ${formatDay(cycle.closesOn)}`;
    if (left === null) return { text: when, urgent: false };
    const remaining = left === 0 ? "closes today" : left === 1 ? "1 day left" : `${left} days left`;
    return { text: `${when} · ${remaining}`, urgent: left <= 14 };
  }
  if (cycleState === "open") return { text: "Open now", urgent: false };
  if (cycleState === "upcoming") {
    return {
      text: cycle?.opensOn ? `Opens ${formatDay(cycle.opensOn)}` : "Opening soon",
      urgent: false,
    };
  }
  if (cycleState === "closed") return { text: "Closed for now", urgent: false };
  return null;
}

/** "A", "A and B", "A, B and C". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * A page description that is true of what is listed. It names the entries that
 * are actually published (the first few), instead of a fixed list of schemes
 * that may or may not have been added yet.
 */
export function describeListing(base: string, titles: string[]): string {
  const named = titles.slice(0, 3);
  if (named.length === 0) return base;
  const more = titles.length > named.length ? ` and ${titles.length - named.length} more` : "";
  return `${base} Listed now: ${listOf(named)}${more}.`;
}
