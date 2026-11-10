import { describe, expect, it } from "vitest";

import {
  hasFollowableDates,
  ownerLine,
  primaryAction,
  whenAnswer,
  whoLine,
} from "@/modules/opportunities/utils/atAGlance";

const TODAY = "2026-11-10";

describe("whenAnswer", () => {
  it("gives the closing date as the headline and the days left as the detail", () => {
    const when = whenAnswer({ cycleState: "open", cycle: { closesOn: "2026-11-16" } }, TODAY);
    expect(when.headline).toBe("Closes 16 Nov 2026");
    expect(when.detail).toBe("6 days left. Applications are open now.");
    expect(when.urgent).toBe(true);
  });

  it("is not urgent more than two weeks out", () => {
    expect(
      whenAnswer({ cycleState: "open", cycle: { closesOn: "2026-12-30" } }, TODAY).urgent
    ).toBe(false);
  });

  it("says when a window opens", () => {
    const when = whenAnswer(
      { cycleState: "upcoming", cycle: { opensOn: "2026-12-01", closesOn: "2026-12-31" } },
      TODAY
    );
    expect(when.headline).toBe("Opens 1 Dec 2026");
    expect(when.detail).toBe("Closes 31 Dec 2026.");
  });

  it("says a closed window is closed, and that the next dates are not out", () => {
    const when = whenAnswer({ cycleState: "closed", cycle: { closesOn: "2026-10-01" } }, TODAY);
    expect(when.headline).toBe("Closed for now");
    expect(when.detail).toMatch(/next dates are not out yet/);
  });

  it("says there are no fixed dates rather than inventing one", () => {
    expect(whenAnswer({ cycleState: "rolling", cycle: undefined }, TODAY).headline).toBe(
      "No fixed dates"
    );
  });
});

describe("whoLine", () => {
  it("puts the editor's one line first, ahead of the age rule", () => {
    expect(whoLine({ summary: "Aspiring footballers of any age", ageMin: 8, ageMax: 14 })).toBe(
      "Aspiring footballers of any age"
    );
  });

  it("falls back to the age and gender rules, then to nothing", () => {
    expect(whoLine({ ageMin: 8, ageMax: 14, gender: "female" })).toBe(
      "Ages 8 to 14 · Girls and women only"
    );
    expect(whoLine(undefined)).toBeNull();
  });
});

describe("ownerLine", () => {
  it("adds the kind of body only when its name does not already say it", () => {
    expect(ownerLine({ name: "SBI Foundation", type: "foundation" })).toBe("SBI Foundation");
    expect(ownerLine({ name: "Department of Sports, Haryana", type: "state-government" })).toBe(
      "Department of Sports, Haryana · State government"
    );
    expect(ownerLine(undefined)).toBeNull();
  });
});

describe("primaryAction", () => {
  const sources = [{ label: "Official page", url: "https://example.org/rules" }];

  it("goes to the application when there is one to apply to", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "open",
        selection: "apply",
        sources,
      })
    ).toEqual({ href: "https://example.org/apply", label: "Apply on the official website" });
  });

  it("falls back to the first source when there is no application link", () => {
    expect(primaryAction({ cycleState: "rolling", selection: "apply", sources })).toEqual({
      href: "https://example.org/rules",
      label: "Open the official website",
    });
  });

  it("does not send a parent to apply once the window has closed", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "closed",
        selection: "apply",
        sources,
      })?.label
    ).toBe("Open the official website");
  });

  it("does not call a nominated or scouted route an application", () => {
    expect(
      primaryAction({
        applyUrl: "https://example.org/apply",
        cycleState: "open",
        selection: "nominated",
        sources,
      })?.label
    ).toBe("Open the official website");
  });

  it("offers nothing when there is no link at all", () => {
    expect(primaryAction({ cycleState: "rolling", selection: "apply", sources: [] })).toBeNull();
  });
});

describe("hasFollowableDates", () => {
  it("is true only when the window has a date an alert could be about", () => {
    expect(hasFollowableDates({ cycle: undefined })).toBe(false);
    expect(hasFollowableDates({ cycle: { keyDates: [] } })).toBe(false);
    expect(hasFollowableDates({ cycle: { opensOn: "2026-11-01" } })).toBe(true);
    expect(hasFollowableDates({ cycle: { closesOn: "2026-12-01" } })).toBe(true);
  });
});
