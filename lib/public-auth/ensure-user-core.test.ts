import { describe, expect, it } from "vitest";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";


describe("validateEnsureUserInput", () => {
  it("accepts a plain email (OTP flow), normalizing it", () => {
    const r = validateEnsureUserInput({ email: "  A@B.Co " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe("a@b.co");
    expect(r.password).toBeNull();
  });

  it("accepts email + password (register flow), min 8 chars", () => {
    const r = validateEnsureUserInput({ email: "a@b.co", password: "12345678" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe("a@b.co");
    expect(r.password).toBe("12345678");
  });

  it("rejects short passwords", () => {
    const r = validateEnsureUserInput({ email: "a@b.co", password: "1234567" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects missing or malformed emails", () => {
    for (const email of [undefined, "", "nope", "a@", "@b.co", 42]) {
      const r = validateEnsureUserInput({ email });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects non-string passwords", () => {
    expect(validateEnsureUserInput({ email: "a@b.co", password: 123 }).ok).toBe(false);
  });
});

describe("validateEnsureUserInput — lead fields", () => {
  const gut = {
    email: "a@b.de",
    firstname: "Ada",
    lastname: "Lovelace",
    processing_consent: true,
    marketing_consent: true,
    consent_version: "2026-08-18",
    source: "eu-ai-act-bot",
  };

  it("accepts a complete body and normalises the names", () => {
    const r = validateEnsureUserInput({ ...gut, firstname: "  Ada  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.firstname).toBe("Ada");
    expect(r.lastname).toBe("Lovelace");
    expect(r.marketingConsent).toBe(true);
    expect(r.consentVersion).toBe("2026-08-18");
    expect(r.source).toBe("eu-ai-act-bot");
  });

  it("rejects a body without the mandatory processing consent", () => {
    // Art. 7 GDPR: without this we may not store the data at all.
    const r = validateEnsureUserInput({ ...gut, processing_consent: false });
    expect(r.ok).toBe(false);
  });

  it("defaults marketing consent to false when absent", () => {
    const { marketing_consent, ...ohne } = gut;
    const r = validateEnsureUserInput(ohne);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.marketingConsent).toBe(false);
  });

  it("rejects empty names", () => {
    expect(validateEnsureUserInput({ ...gut, firstname: "   " }).ok).toBe(false);
    expect(validateEnsureUserInput({ ...gut, lastname: "" }).ok).toBe(false);
  });

  it("still accepts the old password-only body", () => {
    // The Exulu public-agents pages call this route without names or consent.
    // Breaking them would be a regression in a feature we are not touching.
    const r = validateEnsureUserInput({ email: "a@b.de", password: "longenough" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.firstname).toBe("");
    expect(r.marketingConsent).toBe(false);
  });
});
