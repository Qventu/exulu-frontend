import { describe, expect, it } from "vitest";

import { parseTimestampRefs, secondsFromSeekHref, timestampRefsToLinks } from "./linkify";

describe("parseTimestampRefs", () => {
  it("splits a bracketed mm:ss reference out of the surrounding prose", () => {
    expect(parseTimestampRefs("We agreed the scope [21:40] and moved on.")).toEqual([
      { text: "We agreed the scope ", seconds: null },
      { text: "21:40", seconds: 1300 },
      { text: " and moved on.", seconds: null },
    ]);
  });

  it("handles h:mm:ss", () => {
    expect(parseTimestampRefs("[1:02:03]")).toEqual([{ text: "1:02:03", seconds: 3723 }]);
  });

  it("finds several references in one line", () => {
    const parts = parseTimestampRefs("First [00:30] then [01:00].");
    expect(parts.filter((p) => p.seconds !== null).map((p) => p.seconds)).toEqual([30, 60]);
  });

  it("leaves text with no references as one plain part", () => {
    expect(parseTimestampRefs("Nothing to link here.")).toEqual([
      { text: "Nothing to link here.", seconds: null },
    ]);
  });

  it("ignores a bracketed value that is not a time", () => {
    // Markdown links and footnotes must survive untouched.
    expect(parseTimestampRefs("See [the doc](x) and [1].")).toEqual([
      { text: "See [the doc](x) and [1].", seconds: null },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseTimestampRefs("")).toEqual([]);
  });
});

describe("timestampRefsToLinks", () => {
  it("rewrites a reference into a markdown link the renderer can intercept", () => {
    expect(timestampRefsToLinks("We agreed the scope [21:40] and moved on.")).toBe(
      "We agreed the scope [21:40](#t=1300) and moved on.",
    );
  });

  it("leaves markdown without references untouched", () => {
    const md = "### Summary\n\n* **Scope** agreed\n";
    expect(timestampRefsToLinks(md)).toBe(md);
  });

  it("handles h:mm:ss and several references in one document", () => {
    expect(timestampRefsToLinks("[1:02:03] then [00:30]")).toBe(
      "[1:02:03](#t=3723) then [00:30](#t=30)",
    );
  });

  it("returns an empty string for empty input", () => {
    expect(timestampRefsToLinks("")).toBe("");
  });
});

describe("secondsFromSeekHref", () => {
  it("reads the seconds back out of a seek href", () => {
    expect(secondsFromSeekHref("#t=1300")).toBe(1300);
    expect(secondsFromSeekHref("#t=0")).toBe(0);
  });

  it("returns null for a real link, so it renders as an anchor", () => {
    expect(secondsFromSeekHref("https://example.com")).toBeNull();
    expect(secondsFromSeekHref("#section")).toBeNull();
    expect(secondsFromSeekHref(undefined)).toBeNull();
  });

  it("returns null rather than NaN for a malformed seek href", () => {
    expect(secondsFromSeekHref("#t=abc")).toBeNull();
  });
});
