import { describe, expect, it } from "vitest";

import { amountParts, formatAmount } from "@/modules/opportunities/utils/format";

const inr = (value: number, period: string, note?: string) =>
  ({ value, currency: "INR", period, ...(note ? { note } : {}) }) as never;

describe("amount wording", () => {
  it("puts a qualifier in front of the figure, without a colon", () => {
    expect(
      formatAmount({ value: 50000, currency: "USD", period: "year", note: "Up to" } as never)
    ).toBe("Up to $50,000 a year");
  });

  it("keeps any other note after the figure", () => {
    expect(formatAmount(inr(40000, "month", "for one year"))).toBe(
      "₹40,000 a month (for one year)"
    );
    expect(amountParts(inr(40000, "month", "for one year"))).toEqual({
      money: "₹40,000 a month",
      note: "for one year",
    });
  });

  it("drops the trailing full stop of a sentence note", () => {
    expect(amountParts(inr(628000, "year", "Includes coaching and diet."))?.note).toBe(
      "Includes coaching and diet"
    );
  });

  it("says just the figure when there is no note", () => {
    expect(formatAmount(inr(628000, "year"))).toBe("₹6,28,000 a year");
  });
});
