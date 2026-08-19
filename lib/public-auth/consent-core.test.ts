import { describe, expect, it } from "vitest";
import {
  checkHoneypot,
  checkTiming,
  MIN_FILL_MS,
  MAX_FORM_AGE_MS,
} from "@/lib/public-auth/consent-core";

describe("checkHoneypot", () => {
  it("treats an empty or absent honeypot as human", () => {
    expect(checkHoneypot({ website: "" })).toBe("human");
    expect(checkHoneypot({})).toBe("human");
    expect(checkHoneypot(null)).toBe("human");
  });

  it("treats a filled honeypot as bot", () => {
    expect(checkHoneypot({ website: "http://spam.example" })).toBe("bot");
  });

  it("ignores surrounding whitespace", () => {
    // A browser that autofills a single space must not brand a real user.
    expect(checkHoneypot({ website: "   " })).toBe("human");
  });
});

describe("checkTiming", () => {
  const now = 1_800_000_000_000;

  it("accepts a form filled at human speed", () => {
    expect(checkTiming(now - 10_000, now)).toBe("human");
  });

  it("rejects a submission that arrives too fast", () => {
    expect(checkTiming(now - (MIN_FILL_MS - 1), now)).toBe("bot");
  });

  it("rejects a form that has gone stale", () => {
    expect(checkTiming(now - (MAX_FORM_AGE_MS + 1), now)).toBe("bot");
  });

  it("accepts a missing or malformed timestamp", () => {
    // rendered_at comes from the client and is trivially forgeable, so it can
    // only ever be a weak signal. An absent value must not lock anyone out —
    // an older frontend release that does not send it would otherwise have
    // every one of its users classified as a bot.
    expect(checkTiming(undefined, now)).toBe("human");
    expect(checkTiming("nonsense", now)).toBe("human");
  });

  it("accepts a timestamp from the near future", () => {
    // Clock skew between client and server is common and is not evidence of
    // anything.
    expect(checkTiming(now + 5_000, now)).toBe("human");
  });
});
