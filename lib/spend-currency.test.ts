import { describe, expect, it } from "vitest";

import { spendCurrency } from "./spend-currency";

describe("spendCurrency", () => {
  it("keeps the product on USD and en-US", () => {
    expect(spendCurrency(false)).toEqual({ currency: "USD", locale: "en-US" });
  });

  it("shows the German demo its own currency", () => {
    expect(spendCurrency(true)).toEqual({ currency: "EUR", locale: "de-DE" });
  });

  it("formats a demo amount the German way", () => {
    const { currency, locale } = spendCurrency(true);
    // Intl puts a non-breaking space before the sign; any whitespace is fine.
    expect(new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(213.19))
      .toMatch(/^213,19\s€$/);
  });
});
