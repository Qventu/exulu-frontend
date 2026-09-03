import { describe, expect, it } from "vitest";
import { contentText, isEmptyContent, type ContentBlock } from "./content";

describe("contentText", () => {
  it("flattens every block kind into searchable text", () => {
    const blocks: ContentBlock[] = [
      { kind: "paragraph", text: "Eine Frage." },
      { kind: "bullets", items: ["Erstens", "Zweitens"] },
      { kind: "callout", tone: "quote", text: "Zitat" },
      { kind: "stat", value: "1.000", label: "Dokumente" },
      { kind: "figure", src: "/demo/x.webp", alt: "Schema" },
      { kind: "sequence", steps: ["Lesen", "Zerlegen"] },
    ];
    const text = contentText(blocks);
    for (const fragment of [
      "Eine Frage.", "Erstens", "Zweitens", "Zitat",
      "1.000", "Dokumente", "Schema", "Lesen", "Zerlegen",
    ]) {
      expect(text).toContain(fragment);
    }
  });

  // A figure with no alt contributes nothing rather than "undefined".
  it("omits a missing alt", () => {
    expect(contentText([{ kind: "figure", src: "/a.webp" }])).not.toContain("undefined");
  });
});

describe("isEmptyContent", () => {
  it("is true for no blocks", () => {
    expect(isEmptyContent([])).toBe(true);
  });

  // The failure this guards: a step whose copy was deleted still renders a
  // panel, with a title over nothing. Whitespace counts as empty.
  it("is true for blocks that carry no words", () => {
    expect(isEmptyContent([{ kind: "paragraph", text: "   " }])).toBe(true);
    expect(isEmptyContent([{ kind: "bullets", items: [] }])).toBe(true);
  });

  it("is false for real copy", () => {
    expect(isEmptyContent([{ kind: "paragraph", text: "Text" }])).toBe(false);
  });
});
