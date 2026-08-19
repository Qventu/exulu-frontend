import { describe, expect, it } from "vitest";
import {
  otpRateLimited,
  IP_LIMITS,
  EMAIL_LIMITS,
} from "@/lib/public-auth/otp-rate-limit";

/** Minimal in-memory stand-in for the pg client, mimicking the upsert. */
function fakeClient() {
  const rows = new Map<string, { count: number; window_start: number }>();
  return {
    rows,
    query: async (sql: string, params: unknown[]) => {
      const [key, now, windowMs] = params as [string, number, number];
      const vorhanden = rows.get(key);
      if (!vorhanden || now - vorhanden.window_start >= windowMs) {
        rows.set(key, { count: 1, window_start: now });
        return { rows: [{ count: 1 }] };
      }
      vorhanden.count += 1;
      return { rows: [{ count: vorhanden.count }] };
    },
  };
}

describe("otpRateLimited", () => {
  const now = 1_800_000_000_000;

  it("allows up to the limit, then blocks", async () => {
    const c = fakeClient();
    const z = [{ key: "ip:1.2.3.4:15m", limit: 3, windowMs: 900_000 }];
    expect(await otpRateLimited(c, z, now)).toBe(false);
    expect(await otpRateLimited(c, z, now)).toBe(false);
    expect(await otpRateLimited(c, z, now)).toBe(false);
    expect(await otpRateLimited(c, z, now)).toBe(true);
  });

  it("counts each dimension separately", async () => {
    const c = fakeClient();
    const ip = [{ key: "ip:1.2.3.4:15m", limit: 2, windowMs: 900_000 }];
    const mail = [{ key: "email:a@b.de:15m", limit: 2, windowMs: 900_000 }];
    await otpRateLimited(c, ip, now);
    await otpRateLimited(c, ip, now);
    // The IP is exhausted; a different email from elsewhere must still pass.
    expect(await otpRateLimited(c, mail, now)).toBe(false);
  });

  it("blocks when ANY counter is over its limit", async () => {
    const c = fakeClient();
    const beide = [
      { key: "ip:1.2.3.4:15m", limit: 5, windowMs: 900_000 },
      { key: "email:a@b.de:15m", limit: 1, windowMs: 900_000 },
    ];
    expect(await otpRateLimited(c, beide, now)).toBe(false);
    // The IP still has room, the email does not — that must be enough to stop.
    expect(await otpRateLimited(c, beide, now)).toBe(true);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const c = fakeClient();
    const z = [{ key: "ip:1.2.3.4:15m", limit: 1, windowMs: 900_000 }];
    await otpRateLimited(c, z, now);
    expect(await otpRateLimited(c, z, now)).toBe(true);
    expect(await otpRateLimited(c, z, now + 900_001)).toBe(false);
  });

  it("lets the request through when the database errors", async () => {
    // Failing closed would turn a database hiccup into a total outage of
    // registration. Failing open costs, at worst, an unthrottled window.
    const kaputt = {
      query: async () => {
        throw new Error("connection lost");
      },
    };
    const z = [{ key: "ip:1.2.3.4:15m", limit: 1, windowMs: 900_000 }];
    expect(await otpRateLimited(kaputt, z, now)).toBe(false);
  });

  it("limits an email harder than an IP", async () => {
    // The email dimension is what protects a THIRD PARTY from being mailed.
    // An IP limit only protects the service, and an attacker has many IPs.
    const proIp = IP_LIMITS("1.2.3.4")[0].limit;
    const proMail = EMAIL_LIMITS("a@b.de")[0].limit;
    expect(proMail).toBeLessThan(proIp);
  });
});
