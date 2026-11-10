import { OWNER_TYPE_LABELS } from "../config/tracks";
import type { Opportunity } from "../services/opportunities";
import { cycleLine, daysUntil, eligibilityChips, formatDay } from "./format";

// ─── The short answers at the top of an entry's page ────────────────────────
//
// A parent arriving on an entry asks a few things before anything else: what do
// we get, by when, and how are players chosen. The answers already exist as
// fields on the entry; these read them into short lines so the page can put them
// together at the top. Nothing here is written for the page: a field that is not
// set gives nothing, rather than a guess.

export interface WhenAnswer {
  /** The one line that answers "when", set large: "Closes 16 Nov 2026". */
  headline: string;
  /** What to make of it: "6 days left", or what to do when there is no date. */
  detail: string | null;
  /** Inside two weeks of closing. */
  urgent: boolean;
}

/**
 * "When" as a headline and a detail, against India's `today` ("YYYY-MM-DD").
 * A rolling entry says it has no fixed dates: leaving the answer out would read
 * as "we forgot", and a date would be invented.
 */
export function whenAnswer(
  opportunity: Pick<Opportunity, "cycle" | "cycleState">,
  today: string
): WhenAnswer {
  const { cycle, cycleState } = opportunity;
  if (cycleState === "open") {
    if (!cycle?.closesOn) {
      return {
        headline: "Open now",
        detail: "No closing date given. Check the official website.",
        urgent: false,
      };
    }
    const left = daysUntil(cycle.closesOn, today);
    const remaining =
      left === null
        ? null
        : left === 0
          ? "Closes today"
          : left === 1
            ? "1 day left"
            : `${left} days left`;
    return {
      headline: `Closes ${formatDay(cycle.closesOn)}`,
      detail: remaining ? `${remaining}. Applications are open now.` : "Applications are open now.",
      urgent: left !== null && left <= 14,
    };
  }
  if (cycleState === "upcoming") {
    return {
      headline: cycle?.opensOn ? `Opens ${formatDay(cycle.opensOn)}` : "Opening soon",
      detail: cycle?.closesOn ? `Closes ${formatDay(cycle.closesOn)}.` : null,
      urgent: false,
    };
  }
  if (cycleState === "closed") {
    return { headline: "Closed for now", detail: cycleLine(opportunity), urgent: false };
  }
  return {
    headline: "No fixed dates",
    detail: "Check the official website for timings.",
    urgent: false,
  };
}

/**
 * Who it is for, in one line: the editor's summary, or else the age and gender
 * rules. Null when neither is recorded, so the rules section is the answer.
 */
export function whoLine(eligibility: Opportunity["eligibility"]): string | null {
  const summary = eligibility?.summary?.trim();
  if (summary) return summary;
  const chips = eligibilityChips(eligibility);
  return chips.length > 0 ? chips.join(" · ") : null;
}

/**
 * "Department of Sports, Haryana · State government", but just "SBI Foundation"
 * where the kind of body is already in its name ("Foundation · Foundation").
 */
export function ownerLine(owner: Opportunity["owner"]): string | null {
  if (!owner?.name) return null;
  const kind = OWNER_TYPE_LABELS[owner.type];
  if (!kind) return owner.name;
  const name = owner.name.toLowerCase();
  const said = kind
    .toLowerCase()
    .split(" ")
    .some((word) => word.length > 3 && name.includes(word));
  return said ? owner.name : `${owner.name} · ${kind}`;
}

export interface PrimaryAction {
  href: string;
  label: string;
}

/**
 * The one thing a parent can do from the page: go to the official application
 * when there is one to apply to, otherwise to the official page. The entry's
 * first source is the fallback, because every published entry has at least one
 * and it is the page an editor checked the rules against.
 */
export function primaryAction(
  opportunity: Pick<Opportunity, "applyUrl" | "cycleState" | "selection" | "sources">
): PrimaryAction | null {
  const canApply =
    opportunity.applyUrl &&
    opportunity.cycleState !== "closed" &&
    (opportunity.selection === "apply" || opportunity.selection === "trials");
  if (canApply && opportunity.applyUrl) {
    return { href: opportunity.applyUrl, label: "Apply on the official website" };
  }
  const source = opportunity.sources?.[0];
  return source ? { href: source.url, label: "Open the official website" } : null;
}

/**
 * Whether there is a date for an alert to be about. Following an entry only ever
 * produces an email when its window is about to open or close, so on one with no
 * dates the button would promise something that cannot happen.
 */
export function hasFollowableDates(opportunity: Pick<Opportunity, "cycle">): boolean {
  return Boolean(opportunity.cycle?.opensOn || opportunity.cycle?.closesOn);
}
