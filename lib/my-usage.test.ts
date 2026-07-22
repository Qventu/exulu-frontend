import { describe, expect, it } from "vitest";

import {
  buildMyUsagePath,
  chartMetricFor,
  fillDailySeries,
  type MyUsageDailyRow,
} from "./my-usage";

const day = (date: string, spend: number): MyUsageDailyRow => ({
  date,
  spend,
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 100,
  successful_requests: 1,
  failed_requests: 0,
  api_requests: 1,
});

describe("buildMyUsagePath", () => {
  it("passes YYYY-MM-DD through", () => {
    expect(
      buildMyUsagePath({ start_date: "2026-07-01", end_date: "2026-07-20" }),
    ).toBe("/me/usage?start_date=2026-07-01&end_date=2026-07-20");
  });

  it("slices ISO datetimes to the date part", () => {
    expect(
      buildMyUsagePath({
        start_date: "2026-07-01T00:00:00.000Z",
        end_date: "2026-07-20T23:59:59.000Z",
      }),
    ).toBe("/me/usage?start_date=2026-07-01&end_date=2026-07-20");
  });
});

describe("chartMetricFor", () => {
  it("charts spend in amount mode and tokens in percent mode", () => {
    expect(chartMetricFor("amount")).toBe("spend");
    expect(chartMetricFor("percent")).toBe("total_tokens");
  });
});

describe("fillDailySeries", () => {
  it("zero-fills missing days across the window, keeping real rows", () => {
    const filled = fillDailySeries([day("2026-07-02", 5)], {
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    });
    expect(filled.map((r) => r.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
    expect(filled.map((r) => r.spend)).toEqual([0, 5, 0]);
  });

  it("returns the rows sorted as-is when the window is unparsable", () => {
    const rows = [day("2026-07-02", 2), day("2026-07-01", 1)];
    const filled = fillDailySeries(rows, {
      start_date: "nope",
      end_date: "2026-07-03",
    });
    expect(filled.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });
});
