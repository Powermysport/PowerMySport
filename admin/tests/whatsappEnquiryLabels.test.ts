import { describe, expect, it } from "vitest";

import {
  ANSWERED_BY_LABEL,
  CATEGORY_LABEL,
  FOLLOW_UP_LABEL,
  SETTABLE_STATUSES,
  replyDue,
  spanLabel,
  statusBadge,
  topicOf,
} from "@/modules/whatsapp-pilot/utils/enquiryLabels";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = new Date("2026-11-12T10:00:00Z").getTime();

describe("the names the team sees", () => {
  it("uses the team's words for each stored status", () => {
    expect(FOLLOW_UP_LABEL).toEqual({
      none: "No team follow-up",
      new: "New",
      reviewing: "Under review",
      contacted: "Responded",
      done: "Closed",
    });
  });

  it("lets a person set new, under review, responded and closed, and never none", () => {
    expect([...SETTABLE_STATUSES]).toEqual(["new", "reviewing", "contacted", "done"]);
  });

  it("names every category, including the three the menu added", () => {
    expect(CATEGORY_LABEL.scholarships).toBe("Scholarships");
    expect(CATEGORY_LABEL.admissions).toBe("School and college entry");
    expect(CATEGORY_LABEL.fitness).toBe("Fitness and sports support");
    expect(Object.keys(CATEGORY_LABEL)).toHaveLength(9);
  });

  it("has no em dash in anything it shows", () => {
    const all = [
      ...Object.values(FOLLOW_UP_LABEL),
      ...Object.values(CATEGORY_LABEL),
      ...Object.values(ANSWERED_BY_LABEL),
    ];
    for (const text of all) expect(text).not.toContain("—");
  });
});

describe("the badge on a row", () => {
  it("shows where a request with the team stands", () => {
    expect(statusBadge({ followUpStatus: "new" })).toEqual({ label: "New", tone: "amber" });
    expect(statusBadge({ followUpStatus: "reviewing" })).toEqual({
      label: "Under review",
      tone: "blue",
    });
    expect(statusBadge({ followUpStatus: "contacted" })?.label).toBe("Responded");
    expect(statusBadge({ followUpStatus: "done" })?.label).toBe("Closed");
  });

  it("says AI answered when the assistant answered and nothing is with the team", () => {
    expect(statusBadge({ followUpStatus: "none", answeredBy: "assistant" })?.label).toBe(
      "AI answered"
    );
  });

  it("has no badge when there is nothing to say", () => {
    expect(statusBadge({ followUpStatus: "none" })).toBeNull();
    expect(statusBadge({ followUpStatus: "none", answeredBy: "team" })).toBeNull();
  });

  it("prefers the team's status over the AI label once the team has it", () => {
    expect(statusBadge({ followUpStatus: "new", answeredBy: "assistant" })?.label).toBe("New");
  });
});

describe("the topic of a request", () => {
  it("uses the category, and for older enquiries the help that was asked for", () => {
    expect(topicOf({ category: "tournaments", assistance: [] })).toBe("Tournaments");
    expect(topicOf({ assistance: ["coach", "team"] })).toBe("Coach or academy, Team");
    expect(topicOf({ assistance: [] })).toBeNull();
  });
});

describe("when the team's reply is due", () => {
  it("says nothing when no reply is owed", () => {
    expect(replyDue({}, NOW)).toBeNull();
  });

  it("counts down to the due time", () => {
    const due = (ms: number) => ({ replyDueAt: new Date(NOW + ms).toISOString() });
    expect(replyDue(due(5 * HOUR), NOW)).toEqual({ label: "Due in 5h", overdue: false });
    expect(replyDue(due(2 * HOUR + 30 * MIN), NOW)).toEqual({
      label: "Due in 2h 30m",
      overdue: false,
    });
    expect(replyDue(due(40 * MIN), NOW)).toEqual({ label: "Due in 40m", overdue: false });
    expect(replyDue(due(10 * 1000), NOW)).toEqual({ label: "Due in 1m", overdue: false });
  });

  it("counts up from the due time once it has passed, and marks it overdue", () => {
    const due = (ms: number) => ({ replyDueAt: new Date(NOW - ms).toISOString() });
    expect(replyDue(due(3 * HOUR), NOW)).toEqual({ label: "Overdue by 3h", overdue: true });
    expect(replyDue(due(HOUR + 5 * MIN), NOW)).toEqual({
      label: "Overdue by 1h 5m",
      overdue: true,
    });
  });

  it("treats exactly the due time as still due, not overdue", () => {
    expect(replyDue({ replyDueAt: new Date(NOW).toISOString() }, NOW)).toEqual({
      label: "Due in 1m",
      overdue: false,
    });
  });

  it("writes spans in the shortest honest form", () => {
    expect(spanLabel(0)).toBe("1m");
    expect(spanLabel(59 * MIN)).toBe("59m");
    expect(spanLabel(60 * MIN)).toBe("1h");
    expect(spanLabel(-(90 * MIN))).toBe("1h 30m");
  });
});
