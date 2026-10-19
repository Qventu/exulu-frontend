import { describe, expect, it } from "vitest";
import { demoCitationOpenable } from "./citations";

/**
 * Chapter 5 asks the visitor to open a citation. Only the software
 * documentation's chunks were exported with their content
 * (fixtures/chunks-ks2xt-de.json); every other citation in the tour's
 * conversations resolves to nothing, and a badge that opens onto
 * "Chunk … not found in context …" with raw ids is worse than one that does
 * not open. The product component asks here before it wires the dialog.
 */
describe("demoCitationOpenable", () => {
  it("is true for a chunk of the exported software documentation", () => {
    expect(demoCitationOpenable("02d50a8f-e703-4461-9c0c-5ab6c695cdfd")).toBe(true);
  });

  it("is false for the Zendesk ticket chapter 5 also cites, and for chapter 6's manuals", () => {
    expect(demoCitationOpenable("ce3ecab9-ca4b-4cb0-b646-fccff533a445")).toBe(false);
    expect(demoCitationOpenable("2cf2c1f0-03c2-48c8-87a0-ce2569a26bf0")).toBe(false);
  });

  it("is false for an empty or unknown id", () => {
    expect(demoCitationOpenable("")).toBe(false);
    expect(demoCitationOpenable("nope")).toBe(false);
  });
});
