import { describe, test, expect } from "vitest";
import { formatRetrievalMetrics } from "./retrieval-metrics";

describe("formatRetrievalMetrics", () => {
  test("formats tokens + seconds with thousands separators", () => {
    expect(
      formatRetrievalMetrics({ inputTokens: 12340, outputTokens: 1205, totalTokens: 13545, durationMs: 61234 }),
    ).toBe("↳ retrieval · 12,340 in / 1,205 out tokens · 61.2 s");
  });
  test("tokens only when duration is absent", () => {
    expect(formatRetrievalMetrics({ inputTokens: 0, outputTokens: 0 })).toBe(
      "↳ retrieval · 0 in / 0 out tokens",
    );
  });
  test("duration only when tokens are absent", () => {
    expect(formatRetrievalMetrics({ durationMs: 2000 })).toBe("↳ retrieval · 2.0 s");
  });
  test("null when there are no usable metrics", () => {
    expect(formatRetrievalMetrics(undefined)).toBeNull();
    expect(formatRetrievalMetrics(null)).toBeNull();
    expect(formatRetrievalMetrics({})).toBeNull();
  });
});
