import { describe, expect, it } from "vitest";

import { SAVINGS_CLAIM, sieFormIn } from "./register";

describe("sieFormIn", () => {
  it("names the Sie-form token in a sentence", () => {
    expect(sieFormIn("Sehen Sie zu, wie der Assistent sucht.")).toBe("Sie");
    expect(sieFormIn("Dort landete eben Ihre Korrektur.")).toBe("Ihre");
    expect(sieFormIn("Wie es bei Ihnen weitergeht.")).toBe("Ihnen");
    expect(sieFormIn("Zehn Ihrer Handbücher")).toBe("Ihrer");
    // The genitive and the adverb slipped past the first pattern (review).
    expect(sieFormIn("echte Fragen Ihres Serviceteams")).toBe("Ihres");
    expect(sieFormIn("Das bleibt Ihrerseits offen.")).toBe("Ihrerseits");
  });

  it("is strict about a sentence-initial Sie, which tour copy avoids", () => {
    expect(sieFormIn("Sie alle finden hier ihren Platz.")).toBe("Sie");
  });

  it("passes du-form, lowercase sie and words that merely start with Sie", () => {
    expect(sieFormIn("Sieh zu, wie der Assistent sucht.")).toBeNull();
    expect(sieFormIn("Das Dokument, aus dem sie stammt.")).toBeNull();
    expect(sieFormIn("Sieben Basen, sieben Lesarten")).toBeNull();
    expect(sieFormIn("Niemand sieht dabei zu.")).toBeNull();
    expect(sieFormIn("deine Korrektur, euer Posteingang, für euch")).toBeNull();
  });
});

describe("SAVINGS_CLAIM", () => {
  it("catches a savings pitch in any register, never the chapter's bare word", () => {
    for (const claim of ["Das spart Ihnen Geld.", "Das spart euch jeden Monat Geld.", "Das spart dir Zeit.", "Das spart Kosten.", "Es rechnet sich.", "günstiger als eine Stelle"]) {
      expect(SAVINGS_CLAIM.test(claim), claim).toBe(true);
    }
    expect(SAVINGS_CLAIM.test("Wir behaupten hier keine Einsparung.")).toBe(false);
    expect(SAVINGS_CLAIM.test("Die Preise je Million Token sind Beispielwerte.")).toBe(false);
  });
});
