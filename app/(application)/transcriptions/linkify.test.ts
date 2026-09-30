import { describe, expect, it } from "vitest";

import { parseTimestampRefs } from "./linkify";

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
