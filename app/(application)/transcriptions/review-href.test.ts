import { describe, expect, it } from "vitest";

import { reviewHref } from "./review-href";

describe("reviewHref", () => {
  it("moves a legacy ?review= link to the review page", () => {
    expect(reviewHref("abc", new URLSearchParams("review=abc"))).toBe(
      "/transcriptions/review/abc",
    );
  });

  it("keeps every other search param", () => {
    expect(
      reviewHref("abc", new URLSearchParams("review=abc&tour=meetings.1")),
    ).toBe("/transcriptions/review/abc?tour=meetings.1");
  });

  it("encodes the id", () => {
    expect(reviewHref("a b", new URLSearchParams())).toBe(
      "/transcriptions/review/a%20b",
    );
  });
});
