import { describe, expect, it } from "vitest";

import { displayName } from "../src/modules/rankings/components/PlayerHero";

describe("displayName", () => {
  it("cases a name AITA published in block capitals", () => {
    expect(displayName("VIKRANT KHANDELWAL")).toBe("Vikrant Khandelwal");
  });

  it("cases an all-capitals surname beside a normal first name", () => {
    expect(displayName("Vikrant KHANDELWAL")).toBe("Vikrant Khandelwal");
  });

  it("keeps the capital after an apostrophe or hyphen", () => {
    expect(displayName("AARAV O'BRIEN-SHAH")).toBe("Aarav O'Brien-Shah");
  });

  it("leaves a name already in mixed case, an initial and a numeral alone", () => {
    expect(displayName("Aarav McDonald")).toBe("Aarav McDonald");
    expect(displayName("RAHUL S. VERMA")).toBe("Rahul S. Verma");
    expect(displayName("Rahul Verma III")).toBe("Rahul Verma III");
  });
});
