import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatCostPerMillion, formatTokens } from "./format";

describe("formatCostPerMillion", () => {
  it("renders dollars with two decimals for the product, free models included", () => {
    expect(formatCostPerMillion(1.25, { currency: "USD", locale: "en-US" })).toBe("$1.25");
    expect(formatCostPerMillion(0, { currency: "USD", locale: "en-US" })).toBe("$0.00");
  });

  it("renders euros the German way for the demo", () => {
    // Intl separates the amount and the sign with a no-break space.
    expect(formatCostPerMillion(2, { currency: "EUR", locale: "de-DE" })).toBe("2,00 €");
  });

  it("follows the spend currency by default", () => {
    // Not a demo build under vitest: USD.
    expect(formatCostPerMillion(3)).toBe("$3.00");
  });
});

describe("formatTokens", () => {
  it("humanises counts and dashes the unknown", () => {
    expect(formatTokens(1048576)).toBe("1.0M");
    expect(formatTokens(200000)).toBe("200K");
    expect(formatTokens(null)).toBe("—");
  });
});

describe("formatCostPerMillion callers", () => {
  it("never prefix the formatted amount with a currency sign of their own", () => {
    // The helper returns a currency string since sub-project 5; a caller that
    // still writes `$${formatCostPerMillion(...)}` prints "$$1.25" (the model
    // detail sheet did, found in review).
    const dir = __dirname;
    const offenders = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .filter((name) => /\$\$\{formatCostPerMillion/.test(fs.readFileSync(path.join(dir, name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
