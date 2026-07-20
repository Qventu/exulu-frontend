import { describe, expect, it } from "vitest";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";

describe("validateEnsureUserInput", () => {
  it("accepts a plain email (OTP flow), normalizing it", () => {
    expect(validateEnsureUserInput({ email: "  A@B.Co " })).toEqual({
      ok: true,
      email: "a@b.co",
      password: null,
    });
  });

  it("accepts email + password (register flow), min 8 chars", () => {
    expect(validateEnsureUserInput({ email: "a@b.co", password: "12345678" })).toEqual({
      ok: true,
      email: "a@b.co",
      password: "12345678",
    });
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
