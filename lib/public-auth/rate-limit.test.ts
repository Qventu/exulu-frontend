import { beforeEach, describe, expect, it } from "vitest";
import {
  ensureUserRateLimited,
  resetEnsureUserRateLimit,
} from "@/lib/public-auth/rate-limit";

describe("ensureUserRateLimited", () => {
  beforeEach(() => resetEnsureUserRateLimit());

  it("allows 5 per minute per IP, then limits", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(ensureUserRateLimited("1.2.3.4", t0)).toBe(false);
    expect(ensureUserRateLimited("1.2.3.4", t0)).toBe(true);
    expect(ensureUserRateLimited("5.6.7.8", t0)).toBe(false);
  });

  it("resets after the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 6; i++) ensureUserRateLimited("1.2.3.4", t0);
    expect(ensureUserRateLimited("1.2.3.4", t0 + 61_000)).toBe(false);
  });
});
