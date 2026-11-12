import type {
  AnsweredBy,
  AssistanceKind,
  EnquiryCategory,
  FollowUpStatus,
  WhatsAppEnquiry,
} from "@/lib/api/whatsappPilotApi";
import type { StatusTone } from "@/modules/shared/ui/StatusBadge";

/**
 * How the pilot's enquiries are named on screen. The stored words are older than the names the
 * team uses (new, contacted, done), so they are translated here, in one place, for the list, the
 * drawer, the filters and the summary.
 */
export const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  none: "No team follow-up",
  new: "New",
  reviewing: "Under review",
  contacted: "Responded",
  done: "Closed",
};

export const FOLLOW_UP_TONE: Record<FollowUpStatus, StatusTone> = {
  none: "slate",
  new: "amber",
  reviewing: "blue",
  contacted: "green",
  done: "slate",
};

/** The statuses a team member can set by hand. */
export const SETTABLE_STATUSES = ["new", "reviewing", "contacted", "done"] as const;

export const CATEGORY_LABEL: Record<EnquiryCategory, string> = {
  sport: "Choosing a sport",
  start: "Starting or improving",
  coaching: "Coach or academy",
  tournaments: "Tournaments",
  pathway: "Pathway",
  scholarships: "Scholarships",
  admissions: "School and college entry",
  fitness: "Fitness and sports support",
  other: "Something else",
};

export const ANSWERED_BY_LABEL: Record<AnsweredBy, string> = {
  assistant: "AI answered",
  team: "Team",
  pending: "Pending",
};

export const ASSISTANCE_LABEL: Record<AssistanceKind, string> = {
  coach: "Coach or academy",
  tournaments: "Tournaments",
  expert: "Expert",
  team: "Team",
  other: "Other",
};

type StatusInput = Pick<WhatsAppEnquiry, "followUpStatus" | "answeredBy">;

/**
 * The badge for a row. A request with the team shows where it stands; a request the assistant
 * answered says so; anything else has nothing worth a badge.
 */
export function statusBadge(e: StatusInput): { label: string; tone: StatusTone } | null {
  if (e.followUpStatus !== "none") {
    return { label: FOLLOW_UP_LABEL[e.followUpStatus], tone: FOLLOW_UP_TONE[e.followUpStatus] };
  }
  if (e.answeredBy === "assistant") return { label: ANSWERED_BY_LABEL.assistant, tone: "green" };
  return null;
}

/** What the request is about: its category, or for older enquiries the help that was asked for. */
export function topicOf(e: Pick<WhatsAppEnquiry, "category" | "assistance">): string | null {
  if (e.category) return CATEGORY_LABEL[e.category] ?? e.category;
  if (e.assistance.length) return e.assistance.map((a) => ASSISTANCE_LABEL[a] ?? a).join(", ");
  return null;
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** A span in the shortest honest form: "3h 20m", "3h", "40m". Never less than a minute. */
export function spanLabel(ms: number): string {
  const total = Math.abs(ms);
  const hours = Math.floor(total / HOUR_MS);
  const minutes = Math.floor((total % HOUR_MS) / MINUTE_MS);
  if (hours >= 1) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${Math.max(minutes, 1)}m`;
}

/** When the team's reply is due, and whether that time has passed. Null when no reply is owed. */
export function replyDue(
  e: Pick<WhatsAppEnquiry, "replyDueAt">,
  now: number = Date.now()
): { label: string; overdue: boolean } | null {
  if (!e.replyDueAt) return null;
  const left = new Date(e.replyDueAt).getTime() - now;
  return left >= 0
    ? { label: `Due in ${spanLabel(left)}`, overdue: false }
    : { label: `Overdue by ${spanLabel(left)}`, overdue: true };
}
