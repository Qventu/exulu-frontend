import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed } from "@/lib/auth/domain-allowlist";

describe("isEmailDomainAllowed", () => {
  it("allows everything when the env is unset", () => {
    expect(isEmailDomainAllowed("a@evil.com", undefined, undefined)).toBe(true);
  });

  it("enforces the allowlist for internal/unknown users", () => {
    expect(isEmailDomainAllowed("a@acme.com", "acme.com", "user")).toBe(true);
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", "user")).toBe(false);
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", undefined)).toBe(false);
  });

  it("always includes the built-in exulu.com and qventu.com domains", () => {
    expect(isEmailDomainAllowed("a@exulu.com", "acme.com", "user")).toBe(true);
    expect(isEmailDomainAllowed("a@qventu.com", "acme.com", "user")).toBe(true);
  });

  it("exempts existing external users (spec §4.3)", () => {
    expect(isEmailDomainAllowed("a@evil.com", "acme.com", "external")).toBe(true);
  });

  it("handles multi-domain lists with whitespace", () => {
    expect(isEmailDomainAllowed("a@b.co", "acme.com, b.co", "user")).toBe(true);
  });

  it("matches case-insensitively against cased env domains", () => {
    expect(isEmailDomainAllowed("a@acme.com", "Acme.COM", "user")).toBe(true);
  });
});
