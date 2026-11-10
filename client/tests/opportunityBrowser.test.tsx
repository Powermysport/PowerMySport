// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { EligibilityChecklist } from "../src/modules/opportunities/components/EligibilityChecklist";
import { OpportunityBrowser } from "../src/modules/opportunities/components/OpportunityBrowser";
import { OpportunityRow } from "../src/modules/opportunities/components/OpportunityRow";
import type { Opportunity } from "../src/modules/opportunities/services/opportunities";

const TODAY = "2026-10-03";

const entry = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  slug: "an-entry",
  track: "scholarship",
  category: "company",
  title: "An entry",
  summary: "A summary.",
  owner: { name: "An owner", type: "company" },
  sports: [],
  allSports: true,
  geography: { scope: "india" },
  selection: "apply",
  benefit: { summary: "Fee support for the year." },
  cycle: { keyDates: [] },
  lastVerifiedOn: "2026-10-01",
  cycleState: "rolling",
  stale: false,
  ...overrides,
});

const browser = (items: Opportunity[], extra: Record<string, unknown> = {}) =>
  render(
    <OpportunityBrowser
      track="scholarship"
      items={items}
      sports={["tennis", "chess"]}
      categories={["government", "federation", "international", "company", "university"]}
      today={TODAY}
      {...extra}
    />
  );

const type = (label: string, value: string) =>
  act(() => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });

beforeEach(() => {
  localStorage.clear();
  replace.mockClear();
});
afterEach(() => cleanup());

describe("the list when there are only a few entries", () => {
  const few = [
    entry({ slug: "a", title: "Alpha", category: "company" }),
    entry({ slug: "b", title: "Bravo", category: "government" }),
  ];

  it("shows one list rather than headed sections that are mostly empty", () => {
    browser(few);

    expect(screen.queryByRole("heading", { name: "Government", level: 2 })).toBeNull();
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bravo" })).toBeTruthy();
  });

  it("labels each card with its category instead", () => {
    browser(few);

    // The label on the card (a <p>), not the filter chip of the same name.
    expect(screen.getByText("Government", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Companies and foundations", { selector: "p" })).toBeTruthy();
  });

  it("says plainly how much is listed and when it was last checked", () => {
    browser(few);

    expect(screen.getByText("2 scholarships listed so far")).toBeTruthy();
    expect(screen.getByText(/Last checked on 1 Oct 2026/)).toBeTruthy();
    expect(screen.getByText(/We add more once we have checked each one/)).toBeTruthy();
  });

  it("uses the singular for one entry", () => {
    browser([few[0]!]);

    expect(screen.getByText("1 scholarship listed so far")).toBeTruthy();
  });

  it("filters by type with chips, and only when there is more than one type", () => {
    browser(few);

    fireEvent.click(screen.getByRole("button", { name: "Government" }));
    expect(screen.queryByRole("heading", { name: "Alpha" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Bravo" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All types" }));
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeTruthy();

    cleanup();
    browser([few[0]!]);
    expect(screen.queryByRole("group", { name: "Filter by type" })).toBeNull();
  });

  it("offers a person on WhatsApp for what is not listed", () => {
    browser(few);

    const link = screen.getByRole("link", { name: /Ask on WhatsApp/ });
    expect(link.getAttribute("href")).toContain("https://wa.me/");
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("a sports scholarship");
  });
});

describe("the list when there are many entries", () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    entry({
      slug: `e${i}`,
      title: `Entry ${i}`,
      category: i % 2 === 0 ? "government" : "company",
    })
  );

  it("groups them under headed sections, as before", () => {
    browser(many);

    expect(screen.getByRole("heading", { name: "Government", level: 2 })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Companies and foundations", level: 2 })
    ).toBeTruthy();
  });

  it("does not repeat the category on every card, and has no 'more to come' note or ask panel", () => {
    browser(many);

    expect(screen.queryByText(/We add more once we have checked each one/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Ask on WhatsApp/ })).toBeNull();
  });
});

describe("the list when there is nothing", () => {
  it("says it is still being checked, and offers a person, and shows no filter bar", () => {
    browser([]);

    expect(
      screen.getByText("We are still checking these on their official websites.")
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ask on WhatsApp/ })).toBeTruthy();
    expect(screen.queryByText("See which ones suit your child")).toBeNull();
  });
});

describe("finding what fits", () => {
  const items = [
    entry({
      slug: "too-old",
      title: "Under 12s only",
      eligibility: { ageMin: 8, ageMax: 12 },
      cycleState: "open",
    }),
    entry({
      slug: "check-me",
      title: "Needs marks",
      eligibility: { academic: "At least 70% marks" },
    }),
    entry({
      slug: "fits",
      title: "Wide open",
      eligibility: { ageMin: 10, ageMax: 16 },
    }),
  ];
  const titlesInOrder = () =>
    screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

  it("marks nothing until the parent says something about the child", () => {
    browser(items);

    expect(screen.queryByText("Matches your child")).toBeNull();
    expect(screen.queryByText("Does not match")).toBeNull();
  });

  it("marks each entry, and puts the ones that fit first", () => {
    browser(items);

    type("Child's age", "14");
    type("Sport", "tennis");

    expect(screen.getAllByText("Matches your child")).toHaveLength(1);
    expect(screen.getAllByText("Check the details")).toHaveLength(1);
    expect(screen.getAllByText("Does not match")).toHaveLength(1);
    expect(titlesInOrder()).toEqual(["Wide open", "Needs marks", "Under 12s only"]);
  });

  it("summarises how many fit", () => {
    browser(items);
    type("Child's age", "14");
    type("Sport", "tennis");

    const summary = screen.getByRole("status");
    expect(within(summary).getByText("1 match")).toBeTruthy();
    expect(within(summary).getByText("1 to check")).toBeTruthy();
    expect(within(summary).getByText("1 do not match")).toBeTruthy();
  });

  it("can hide the ones that do not match", () => {
    browser(items);
    type("Child's age", "14");
    type("Sport", "tennis");

    fireEvent.click(screen.getByLabelText("Hide the ones that do not match"));

    expect(titlesInOrder()).toEqual(["Wide open", "Needs marks"]);
  });

  it("forgets the child when cleared", () => {
    browser(items);
    type("Child's age", "14");
    expect(screen.getAllByText("Does not match")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));

    expect(screen.queryByText("Does not match")).toBeNull();
    expect((screen.getByLabelText("Child's age") as HTMLInputElement).value).toBe("");
  });

  it("remembers the child on this device", () => {
    browser(items);
    type("Sport", "chess");
    fireEvent.click(screen.getByRole("button", { name: "Girl" }));

    expect(JSON.parse(localStorage.getItem("pms_opportunity_profile")!)).toMatchObject({
      sport: "chess",
      gender: "girl",
    });
  });

  it("ignores a stored state it does not recognise", () => {
    localStorage.setItem("pms_opportunity_profile", JSON.stringify({ state: "Atlantis" }));
    browser(items);

    expect((screen.getByLabelText("State") as HTMLSelectElement).value).toBe("");
  });
});

describe("OpportunityRow", () => {
  it("leads with the amount when there is one", () => {
    render(
      <OpportunityRow
        today={TODAY}
        opportunity={entry({
          benefit: {
            summary: "Covers tuition.",
            amount: { value: 628000, currency: "INR", period: "year" },
          },
        })}
      />
    );

    expect(screen.getByText("₹6,28,000 a year")).toBeTruthy();
    expect(screen.getByText("Covers tuition.")).toBeTruthy();
  });

  it("shows who it is for and how long is left, flagging a close deadline", () => {
    render(
      <OpportunityRow
        today={TODAY}
        opportunity={entry({
          cycleState: "open",
          cycle: { closesOn: "2026-10-10", keyDates: [] },
          eligibility: { ageMin: 10, ageMax: 14, gender: "female" },
        })}
      />
    );

    expect(screen.getByText("Ages 10 to 14")).toBeTruthy();
    expect(screen.getByText("Girls and women only")).toBeTruthy();
    const deadline = screen.getByText("Closes 10 Oct 2026 · 7 days left");
    expect(deadline.className).toContain("font-semibold");
  });

  it("says when it was last checked", () => {
    render(<OpportunityRow today={TODAY} opportunity={entry({ lastVerifiedOn: "2026-10-03" })} />);

    expect(screen.getByText("Last checked 3 Oct 2026")).toBeTruthy();
  });

  it("shows no verdict badge unless one is given", () => {
    const { rerender } = render(<OpportunityRow today={TODAY} opportunity={entry()} />);
    expect(screen.queryByText("Matches your child")).toBeNull();

    rerender(<OpportunityRow today={TODAY} opportunity={entry()} verdict="fits" />);
    expect(screen.getByText("Matches your child")).toBeTruthy();
  });
});

describe("EligibilityChecklist", () => {
  const rules = entry({
    allSports: false,
    sports: ["tennis"],
    eligibility: {
      ageMin: 10,
      ageMax: 14,
      level: "National ranking",
      academic: "At least 70% marks",
    },
  });
  const rowFor = (label: string) => screen.getByText(label, { selector: "p" }).closest("li")!;

  it("lists every rule, and does not claim a verdict before the child is described", () => {
    render(<EligibilityChecklist opportunity={rules} />);

    for (const label of ["Sport", "Age", "Sporting level", "Academic"]) {
      expect(screen.getByText(label, { selector: "p" })).toBeTruthy();
    }
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("gives a rule every child passes no row", () => {
    render(<EligibilityChecklist opportunity={rules} />);

    // Open across India: nothing for the parent to answer, nothing to tick.
    expect(screen.queryByText("Where", { selector: "p" })).toBeNull();
  });

  it("asks each question on the row of the rule it checks", () => {
    render(<EligibilityChecklist opportunity={rules} />);

    expect(within(rowFor("Age")).getByLabelText("Child's age")).toBeTruthy();
    expect(within(rowFor("Sport")).getByLabelText("Child's sport")).toBeTruthy();
  });

  it("ticks what matches and crosses what does not", () => {
    render(<EligibilityChecklist opportunity={rules} />);

    type("Child's age", "16");
    type("Child's sport", "tennis");

    expect(within(rowFor("Sport")).getByText("Matches")).toBeTruthy();
    expect(within(rowFor("Age")).getByText("Does not match")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("does not meet the age rule");
  });

  it("leaves marks and level for the parent, never ticking them", () => {
    render(<EligibilityChecklist opportunity={rules} />);
    type("Child's age", "12");
    type("Child's sport", "tennis");

    const yourself = screen.getByRole("heading", { name: "Check these yourself" }).parentElement!;
    expect(within(yourself).getByText("Academic", { selector: "p" })).toBeTruthy();
    expect(within(yourself).getByText("Sporting level", { selector: "p" })).toBeTruthy();
    expect(within(yourself).queryByText("Matches")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Check the 2 below yourself");
  });

  it("says how far the check has got when only some questions are answered", () => {
    render(<EligibilityChecklist opportunity={rules} />);
    type("Child's sport", "tennis");

    expect(screen.getByRole("status").textContent).toContain("Answer the rest");
    expect(within(rowFor("Age")).getByText("Not checked yet")).toBeTruthy();
  });
});

describe("the one sport control", () => {
  const items = [
    entry({ slug: "t", title: "Tennis only", allSports: false, sports: ["tennis"] }),
    entry({ slug: "c", title: "Chess only", allSports: false, sports: ["chess"] }),
    entry({ slug: "all", title: "Every sport" }),
  ];
  const titles = () =>
    screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

  it("filters the list to the sport, keeping all-sports entries", () => {
    browser(items);
    type("Sport", "tennis");

    expect(titles()).toEqual(["Tennis only", "Every sport"]);
    expect(screen.getByRole("status").textContent).toContain("2 scholarships for Tennis");
  });

  it("is the only sport control on the page", () => {
    browser(items);

    expect(screen.getAllByLabelText("Sport")).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: /sport/i })).toBeNull();
  });

  it("takes the sport from the link it was opened with", () => {
    browser(items, { selectedSport: "chess" });

    expect((screen.getByLabelText("Sport") as HTMLSelectElement).value).toBe("chess");
    expect(JSON.parse(localStorage.getItem("pms_opportunity_profile")!).sport).toBe("chess");
  });

  it("widens a list the server cut to another sport, without scrolling", () => {
    browser(items, { selectedSport: "chess" });
    type("Sport", "tennis");

    expect(replace).toHaveBeenCalledWith("/scholarships", { scroll: false });
  });

  it("lets boy or girl be taken back with a second tap", () => {
    browser(items);
    const girl = screen.getByRole("button", { name: "Girl" });

    fireEvent.click(girl);
    expect(girl.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(girl);
    expect(girl.getAttribute("aria-pressed")).toBe("false");
  });
});
