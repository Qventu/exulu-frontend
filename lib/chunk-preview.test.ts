import { describe, expect, it } from "vitest";

import { chunkPreviewText } from "./chunk-preview";

/**
 * The input below is verbatim from the Newlift staging deployment: chunk 0 of
 * FST2XTchanges-customer-DE.docx, d92dd3f2-2803-41e4-8136-a1a0ccb99e6c. Real
 * input matters here because the thing being matched is a format the backend
 * emits, and a hand-typed approximation is exactly how a regex ends up passing
 * its test and failing in production. Note the leading four-space indent and
 * the trailing double space on the markdown line — both are in the real data.
 */
/**
 * Two trailing spaces: a markdown hard line break, present in the source
 * document. Named rather than typed inline because trailing whitespace in a
 * source file is exactly what a formatter or an editor strips on save — which
 * would quietly turn this into a test of something the backend never sends.
 */
const HARD_BREAK = "  ";

const BODY = [
  `**FST2XT Software${HARD_BREAK}`,
  "Änderungs Historie**",
  "",
  "**Herausgeber:**",
  "",
  "NEW Lift Steuerungsbau GmbH",
].join("\n");

const REAL_CHUNK = [
  "    --- Document (Exulu ID: d92dd3f2-2803-41e4-8136-a1a0ccb99e6c) ---",
  "    Document Name: FST2XTchanges-customer-DE.docx",
  "    -------------------------",
  "",
  "<!-- Current page: 1 -->",
  "",
  BODY,
].join("\n");

describe("the document preamble is removed for display", () => {
  it("strips the header, the rule and the leading page marker", () => {
    const preview = chunkPreviewText(REAL_CHUNK);

    expect(preview.startsWith("**FST2XT Software")).toBe(true);
    expect(preview).not.toContain("Exulu ID");
    expect(preview).not.toContain("Document Name:");
    expect(preview).not.toContain("Current page");
  });

  it("keeps the content itself byte for byte", () => {
    // The point is to remove a prefix, not to reformat. If this ever starts
    // collapsing whitespace or re-wrapping, markdown in the citation dialog
    // breaks — the double space after "Software" is a hard line break.
    expect(chunkPreviewText(REAL_CHUNK)).toBe(BODY);
  });

  it("is idempotent", () => {
    const once = chunkPreviewText(REAL_CHUNK);
    expect(chunkPreviewText(once)).toBe(once);
  });
});

describe("it refuses to eat anything it is not sure about", () => {
  // The failure mode worth guarding is not "preamble survives" — that is
  // merely ugly. It is "the first lines of a customer's document vanish from
  // the only screen that shows what was indexed".

  it("leaves a chunk with no preamble alone", () => {
    const plain = "Kalibrierfahrt: Menue Punkt neu unter Service.";
    expect(chunkPreviewText(plain)).toBe(plain);
  });

  it("leaves a document that merely starts with a horizontal rule alone", () => {
    const content = "---\ntitle: Wartungsplan\n---\n\nInhalt folgt.";
    expect(chunkPreviewText(content)).toBe(content);
  });

  it("does not strip a preamble-shaped block that is not at the start", () => {
    const content = `Erste Zeile.

    --- Document (Exulu ID: abc) ---
    Document Name: other.docx
    -------------------------`;
    expect(chunkPreviewText(content)).toBe(content.trim());
  });

  it("keeps page markers that sit inside the body", () => {
    // A marker mid-chunk is a real page boundary between two passages of text.
    // Only a leading one is redundant.
    const content = `${REAL_CHUNK}

<!-- Current page: 2 -->

Weiter geht es.`;
    expect(chunkPreviewText(content)).toContain("<!-- Current page: 2 -->");
  });

  it("survives empty and whitespace-only content", () => {
    expect(chunkPreviewText("")).toBe("");
    expect(chunkPreviewText("   \n  ")).toBe("");
  });
});
