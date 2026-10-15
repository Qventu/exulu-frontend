import { describe, expect, it } from "vitest";

import { sieFormIn } from "./register";

describe("sieFormIn", () => {
  it("names the Sie-form token in a sentence", () => {
    expect(sieFormIn("Sehen Sie zu, wie der Assistent sucht.")).toBe("Sie");
    expect(sieFormIn("Dort landete eben Ihre Korrektur.")).toBe("Ihre");
    expect(sieFormIn("Wie es bei Ihnen weitergeht.")).toBe("Ihnen");
    expect(sieFormIn("Zehn Ihrer Handbücher")).toBe("Ihrer");
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
