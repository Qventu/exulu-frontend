import { describe, expect, it } from "vitest";
import {
  detectTrigger,
  filterSuggestions,
  findTokenRanges,
  insertToken,
  isAutoHidden,
  type Suggestion,
} from "./matching";

const BOTH = { slash: true, at: true };

describe("detectTrigger", () => {
  it("triggers on '/' as the first character", () => {
    expect(detectTrigger("/", 1, BOTH)).toEqual({ kind: "/", start: 0, query: "" });
  });

  it("triggers on '/' after whitespace with the query up to the caret", () => {
    expect(detectTrigger("hello /we", 9, BOTH)).toEqual({ kind: "/", start: 6, query: "we" });
  });

  it("uses the caret, not the end of text, for the query", () => {
    // caret placed right after "web" in "hello /web tail"
    expect(detectTrigger("hello /web tail", 10, BOTH)).toEqual({ kind: "/", start: 6, query: "web" });
  });

  it("does not trigger mid-word (fractions, emails, urls)", () => {
    expect(detectTrigger("3/4", 3, BOTH)).toBeNull();
    expect(detectTrigger("a@b.com", 7, BOTH)).toBeNull();
    expect(detectTrigger("https://x", 9, BOTH)).toBeNull();
  });

  it("allows spaces inside an '@' query (file names)", () => {
    expect(detectTrigger("@my rep", 7, BOTH)).toEqual({ kind: "@", start: 0, query: "my rep" });
  });

  it("treats a newline as a word start but never spans newlines", () => {
    expect(detectTrigger("line1\n/x", 8, BOTH)).toEqual({ kind: "/", start: 6, query: "x" });
    expect(detectTrigger("/a\nb", 4, BOTH)).toBeNull();
  });

  it("returns the nearest trigger before the caret", () => {
    expect(detectTrigger("@a /b", 5, BOTH)).toEqual({ kind: "/", start: 3, query: "b" });
  });

  it("skips disabled kinds", () => {
    expect(detectTrigger("@x", 2, { slash: true, at: false })).toBeNull();
    expect(detectTrigger("/x", 2, { slash: false, at: true })).toBeNull();
    // disabled '@' is skipped, but an earlier enabled '/' still wins
    expect(detectTrigger("/y @x", 5, { slash: true, at: false })).toEqual({
      kind: "/",
      start: 0,
      query: "y @x",
    });
  });

  it("returns null when the caret is before or at the trigger", () => {
    expect(detectTrigger("/web", 0, BOTH)).toBeNull();
  });
});

describe("findTokenRanges", () => {
  it("finds a known slash token at a word boundary", () => {
    expect(findTokenRanges("use /web_search now", { slash: ["web_search"], at: [] })).toEqual([
      { start: 4, end: 15, kind: "/" },
    ]);
  });

  it("prefers the longest matching name", () => {
    expect(findTokenRanges("/web_search", { slash: ["web", "web_search"], at: [] })).toEqual([
      { start: 0, end: 11, kind: "/" },
    ]);
  });

  it("matches file names containing spaces", () => {
    expect(findTokenRanges("@my report.pdf ok", { slash: [], at: ["my report.pdf"] })).toEqual([
      { start: 0, end: 14, kind: "@" },
    ]);
  });

  it("requires a word start before the trigger", () => {
    expect(findTokenRanges("3/4", { slash: ["4"], at: [] })).toEqual([]);
  });

  it("requires a boundary after the token", () => {
    expect(findTokenRanges("/web_searchx", { slash: ["web_search"], at: [] })).toEqual([]);
    // trailing punctuation is a valid boundary
    expect(findTokenRanges("/web_search.", { slash: ["web_search"], at: [] })).toEqual([
      { start: 0, end: 11, kind: "/" },
    ]);
  });

  it("is exact-case (machine names are inserted verbatim)", () => {
    expect(findTokenRanges("/Web_Search", { slash: ["web_search"], at: [] })).toEqual([]);
  });

  it("finds multiple tokens of mixed kinds", () => {
    expect(findTokenRanges("use /a and @f.txt", { slash: ["a"], at: ["f.txt"] })).toEqual([
      { start: 4, end: 6, kind: "/" },
      { start: 11, end: 17, kind: "@" },
    ]);
  });

  it("returns nothing for unknown names or empty name lists", () => {
    expect(findTokenRanges("/nope", { slash: ["web_search"], at: [] })).toEqual([]);
    expect(findTokenRanges("/web_search", { slash: [], at: [] })).toEqual([]);
  });
});

const sug = (name: string, extra?: Partial<Suggestion>): Suggestion => ({
  id: `tool:${name}`,
  kind: "tool",
  name,
  displayName: name.replace(/_/g, " "),
  ...extra,
});

describe("filterSuggestions", () => {
  const items = [sug("run_code"), sug("search_docs"), sug("web_search")];

  it("returns all items for an empty or whitespace-only query", () => {
    expect(filterSuggestions(items, "")).toEqual(items);
    expect(filterSuggestions(items, "  ")).toEqual(items);
  });

  it("matches case-insensitive substrings of the machine name", () => {
    expect(filterSuggestions(items, "SEARCH").map((s) => s.name)).toEqual([
      "search_docs",
      "web_search",
    ]);
  });

  it("matches the prettified display name (spaces instead of underscores)", () => {
    expect(filterSuggestions(items, "web se").map((s) => s.name)).toEqual(["web_search"]);
  });

  it("ranks prefix matches before substring matches, keeping order stable", () => {
    expect(filterSuggestions(items, "se").map((s) => s.name)).toEqual([
      "search_docs",
      "web_search",
    ]);
  });

  it("matches descriptions when present", () => {
    const withDesc = [sug("aaa", { description: "queries the vector index" })];
    expect(filterSuggestions(withDesc, "vector")).toHaveLength(1);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSuggestions(items, "zzz")).toEqual([]);
  });
});

describe("insertToken", () => {
  const trigger = { kind: "/" as const, start: 3, query: "we" };

  it("replaces trigger+query with the token and a trailing space", () => {
    expect(insertToken("hi /we", trigger, 6, "web_search")).toEqual({
      text: "hi /web_search ",
      caret: 15,
    });
  });

  it("does not double a space that already follows the caret", () => {
    expect(insertToken("hi /we tail", trigger, 6, "web_search")).toEqual({
      text: "hi /web_search tail",
      caret: 15,
    });
  });

  it("keeps text after the caret for '@' tokens with spaces in the name", () => {
    const at = { kind: "@" as const, start: 0, query: "my" };
    expect(insertToken("@my!", at, 3, "my report.pdf")).toEqual({
      text: "@my report.pdf !",
      caret: 15,
    });
  });
});

describe("isAutoHidden", () => {
  it("hides the menu when a whitespace-containing query has zero matches", () => {
    expect(isAutoHidden("web_search more words", 0)).toBe(true);
    expect(isAutoHidden("web_search ", 0)).toBe(true);
  });

  it("keeps the menu visible when there are matches or no whitespace yet", () => {
    expect(isAutoHidden("my rep", 3)).toBe(false); // matches exist
    expect(isAutoHidden("webx", 0)).toBe(false); // zero matches but single word: show "No matches"
    expect(isAutoHidden("", 0)).toBe(false);
  });
});
