// Unit tests for the email-trigger config helpers (pure module).

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EMAIL_TRIGGER_CONFIG,
  FILTER_FIELDS,
  isValidSenderEntry,
  MAX_FILTER_PATTERN_LENGTH,
  normalizeEmailTriggerConfig,
  validateFilterPattern,
} from "./trigger-config";

describe("FILTER_FIELDS", () => {
  it("matches the design §3.1 field union", () => {
    expect(FILTER_FIELDS).toEqual([
      "from",
      "subject",
      "body",
      "attachment_name",
    ]);
  });
});

describe("isValidSenderEntry", () => {
  it("accepts exact addresses (case-insensitive)", () => {
    expect(isValidSenderEntry("service@kone.com")).toBe(true);
    expect(isValidSenderEntry("Service@KONE.com")).toBe(true);
    expect(isValidSenderEntry("first.last+tag@sub.example.co")).toBe(true);
  });
  it("accepts *@domain globs", () => {
    expect(isValidSenderEntry("*@kone.com")).toBe(true);
    expect(isValidSenderEntry("*@sub.example.co")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isValidSenderEntry("")).toBe(false);
    expect(isValidSenderEntry("   ")).toBe(false);
    expect(isValidSenderEntry("kone.com")).toBe(false);
    expect(isValidSenderEntry("@kone.com")).toBe(false);
    expect(isValidSenderEntry("*@")).toBe(false);
    expect(isValidSenderEntry("a b@kone.com")).toBe(false);
    expect(isValidSenderEntry("*@*.com")).toBe(false);
    expect(isValidSenderEntry("user@nodot")).toBe(false);
  });
});

describe("validateFilterPattern", () => {
  it("accepts a sane regex", () => {
    expect(validateFilterPattern("Ersatzteil|spare part")).toEqual({
      ok: true,
    });
  });
  it("rejects empty / whitespace-only", () => {
    expect(validateFilterPattern("")).toEqual({ ok: false, reason: "empty" });
    expect(validateFilterPattern("   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });
  it("rejects patterns over the 200-char server cap (design §8)", () => {
    expect(MAX_FILTER_PATTERN_LENGTH).toBe(200);
    expect(validateFilterPattern("a".repeat(201))).toEqual({
      ok: false,
      reason: "too_long",
    });
    expect(validateFilterPattern("a".repeat(200))).toEqual({ ok: true });
  });
  it("rejects syntactically invalid regexes", () => {
    expect(validateFilterPattern("([unclosed")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("normalizeEmailTriggerConfig", () => {
  it("fills the design §3.1 defaults from nothing", () => {
    expect(normalizeEmailTriggerConfig(undefined)).toEqual(
      DEFAULT_EMAIL_TRIGGER_CONFIG,
    );
    expect(DEFAULT_EMAIL_TRIGGER_CONFIG).toEqual({
      allowed_senders: [],
      filters: [],
      filtered_run_retention: 200,
      rate_limit_per_hour: 60,
      sender_rate_limit_per_hour: 10,
    });
  });
  it("keeps valid values and drops malformed entries", () => {
    expect(
      normalizeEmailTriggerConfig({
        allowed_senders: ["a@b.co", "", 5, "*@kone.com"],
        filters: [
          { field: "subject", pattern: "spare" },
          { field: "nope", pattern: "x" },
          "garbage",
        ],
        filtered_run_retention: 50,
        rate_limit_per_hour: 120,
        sender_rate_limit_per_hour: 5,
      }),
    ).toEqual({
      allowed_senders: ["a@b.co", "*@kone.com"],
      filters: [{ field: "subject", pattern: "spare" }],
      filtered_run_retention: 50,
      rate_limit_per_hour: 120,
      sender_rate_limit_per_hour: 5,
    });
  });
  it("clamps numbers (retention ≥ 0, rates ≥ 1) and falls back on junk", () => {
    // Retention 0 is intentionally allowed: the backend accepts retention 0 = keep no filtered rows (contract-aligned).
    const normalized = normalizeEmailTriggerConfig({
      filtered_run_retention: -3,
      rate_limit_per_hour: 0,
      sender_rate_limit_per_hour: "abc",
    });
    expect(normalized.filtered_run_retention).toBe(0);
    expect(normalized.rate_limit_per_hour).toBe(1);
    expect(normalized.sender_rate_limit_per_hour).toBe(10);
  });
});
