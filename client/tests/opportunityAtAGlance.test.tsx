// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { AtAGlance } from "@/modules/opportunities/components/AtAGlance";
import type { Opportunity } from "@/modules/opportunities/services/opportunities";

const entry = (over: Partial<Opportunity> = {}): Opportunity =>
  ({
    slug: "india-khelo-football-ikf",
    track: "admission",
    category: "academy",
    title: "India Khelo Football",
    sports: ["football"],
    allSports: false,
    selection: "trials",
    benefit: { summary: "A route to clubs and scouts." },
    eligibility: { gender: "any" },
    cycleState: "rolling",
    stale: false,
    sources: [{ label: "Trials", url: "https://example.org/trials" }],
    lastVerifiedOn: "2026-10-03",
    ...over,
  }) as Opportunity;

const rowOf = (label: string) => {
  const term = screen.getByText(label);
  return term.parentElement as HTMLElement;
};

afterEach(cleanup);

const TODAY = "2026-11-10";
const glance = (over: Partial<Opportunity> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AtAGlance opportunity={entry(over)} today={TODAY} />
    </QueryClientProvider>
  );

describe("AtAGlance", () => {
  it("shows the cost when the entry states it", () => {
    glance({
      cost: { kind: "fee", amount: 125, currency: "INR", note: "City round. Free for girls" },
    });
    expect(within(rowOf("Cost")).getByText("₹125. City round. Free for girls")).toBeTruthy();
  });

  it("leaves the cost out when the entry does not say, rather than showing free", () => {
    glance();
    expect(screen.queryByText("Cost")).toBeNull();
    expect(screen.queryByText(/^Free/)).toBeNull();
  });

  it("sets the figure on its own line, with its note under it", () => {
    glance({
      benefit: {
        summary: "Monthly funding.",
        amount: { value: 40000, currency: "INR", period: "month", note: "for one year" },
      },
    });
    expect(screen.getByText("₹40,000 a month")).toBeTruthy();
    expect(screen.getByText("for one year")).toBeTruthy();
    expect(screen.getByText("Monthly funding.")).toBeTruthy();
  });

  it("gives the deadline and the days left", () => {
    glance({ cycleState: "open", cycle: { closesOn: "2026-11-16", keyDates: [] } });
    expect(within(rowOf("When")).getByText("Closes 16 Nov 2026")).toBeTruthy();
    expect(within(rowOf("When")).getByText(/6 days left/)).toBeTruthy();
  });

  it("says how players are chosen", () => {
    glance();
    expect(within(rowOf("How players are chosen")).getByText("Selection trials")).toBeTruthy();
  });

  it("does not offer the follow button on an entry with no dates", () => {
    glance();
    expect(screen.queryByText(/Email me about these dates|Sign in/)).toBeNull();
  });

  it("points at the official page when there is no application link", () => {
    glance();
    const link = screen.getByRole("link", { name: /Open the official website/ });
    expect(link.getAttribute("href")).toBe("https://example.org/trials");
  });
});
