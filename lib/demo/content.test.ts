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
      { kind: "cta", label: "Termin buchen", href: "https://example.invalid" },
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

describe("a call to action", () => {
  it("counts as copy by its label only", () => {
    expect(contentText([{ kind: "cta", label: "Termin buchen", href: "https://example.invalid" }])).toBe("Termin buchen");
  });
});

describe("logos block", () => {
  it("flattens to the names and captions, so the sign-off export and the tests see them", () => {
    expect(
      contentText([
        { kind: "logos", items: [{ name: "NEW Lift", caption: "Doku" }, { name: "ALGI", caption: "Teile", src: "/demo/logos/algi.svg" }] },
      ] as ContentBlock[]),
    ).toBe("NEW Lift — Doku · ALGI — Teile");
  });
});

describe("offer block", () => {
  const offer: ContentBlock = {
    kind: "offer",
    kicker: "Dein nächster Schritt",
    title: "Teste es",
    subtitle: "Keine Theorie mehr.",
    box: { title: "Testphase", price: "600 € / Monat", priceNote: "50 % Rabatt", items: ["Punkt eins", "Punkt zwei"], note: "Limitiert." },
    cta: { label: "Rabatt sichern", href: "https://example.invalid/?utm_campaign=a" },
    microCopy: "30 Minuten.",
  };

  it("reads every word — kicker, hero, box, items, note, button label, micro-copy — but no href", () => {
    const text = contentText([offer]);
    for (const s of ["Dein nächster Schritt", "Teste es", "Keine Theorie mehr.", "Testphase", "600 € / Monat", "50 % Rabatt", "Punkt eins", "Punkt zwei", "Limitiert.", "Rabatt sichern", "30 Minuten."]) {
      expect(text).toContain(s);
    }
    expect(text).not.toContain("example.invalid");
  });

  it("is not empty without a button or a note", () => {
    const { cta: _cta, ...rest } = offer as Extract<ContentBlock, { kind: "offer" }>;
    expect(isEmptyContent([{ ...rest, box: { ...rest.box, note: undefined } }])).toBe(false);
  });
});
