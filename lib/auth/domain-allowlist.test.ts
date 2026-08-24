import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed, isWorkforceEmail } from "@/lib/auth/domain-allowlist";

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

describe("isWorkforceEmail", () => {
  it("reserves the configured workforce domains", () => {
    expect(isWorkforceEmail("a@acme.com", "acme.com")).toBe(true);
    expect(isWorkforceEmail("a@stranger.com", "acme.com")).toBe(false);
  });

  it("reserves the built-in exulu.com and qventu.com domains", () => {
    // The regression that motivated this: daniel@qventu.com — a workforce
    // address by the allowlist's own hardcoded list — was captured as a
    // type='external' row by public signup, which then permanently shadowed
    // the internal account (the (application) layout bounces external users).
    expect(isWorkforceEmail("daniel@qventu.com", "acme.com")).toBe(true);
    expect(isWorkforceEmail("a@exulu.com", "acme.com")).toBe(true);
  });

  it("reserves nothing when no allowlist is configured", () => {
    // An unset env means "no domain policy" for internal sign-in, so there is
    // no workforce/public split to protect. Reserving addresses here would
    // break public registration outright on installs that never set the var.
    expect(isWorkforceEmail("a@acme.com", undefined)).toBe(false);
    expect(isWorkforceEmail("a@qventu.com", "")).toBe(false);
  });

  it("matches case-insensitively on both sides", () => {
    expect(isWorkforceEmail("A@Acme.COM", "acme.com")).toBe(true);
    expect(isWorkforceEmail("a@acme.com", "Acme.COM")).toBe(true);
  });

  it("handles multi-domain lists with whitespace", () => {
    expect(isWorkforceEmail("a@b.co", "acme.com, b.co")).toBe(true);
  });

  it("does not treat a domain as a bare suffix", () => {
    // "notacme.com" ends with "acme.com" as a string but is a different domain.
    expect(isWorkforceEmail("a@notacme.com", "acme.com")).toBe(false);
  });
});
