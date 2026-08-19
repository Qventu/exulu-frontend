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
      const existing = rows.get(key);
      if (!existing || now - existing.window_start >= windowMs) {
        rows.set(key, { count: 1, window_start: now });
        return { rows: [{ count: 1 }] };
      }
      existing.count += 1;
      return { rows: [{ count: existing.count }] };
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
    const both = [
      { key: "ip:1.2.3.4:15m", limit: 5, windowMs: 900_000 },
      { key: "email:a@b.de:15m", limit: 1, windowMs: 900_000 },
    ];
    expect(await otpRateLimited(c, both, now)).toBe(false);
    // The IP still has room, the email does not — that must be enough to stop.
    expect(await otpRateLimited(c, both, now)).toBe(true);
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
    const broken = {
      query: async () => {
        throw new Error("connection lost");
      },
    };
    const z = [{ key: "ip:1.2.3.4:15m", limit: 1, windowMs: 900_000 }];
    expect(await otpRateLimited(broken, z, now)).toBe(false);
  });

  it("limits an email harder than an IP", async () => {
    // The email dimension is what protects a THIRD PARTY from being mailed.
    // An IP limit only protects the service, and an attacker has many IPs.
    const ipLimits = IP_LIMITS("1.2.3.4");
    const emailLimits = EMAIL_LIMITS("a@b.de");
    expect(emailLimits).toHaveLength(ipLimits.length);
    emailLimits.forEach((e, i) => {
      expect(e.limit).toBeLessThan(ipLimits[i].limit);
    });
  });

  it("gives a person enough sends for one signup plus resends", async () => {
    // A registration calls ensure-user and then signin/email back to back.
    // While BOTH charged the email budget, a single signup spent two of three
    // per quarter hour — one attempt plus a resend and the person was locked
    // out of their own signup by a 429 they could do nothing about.
    //
    // ensure-user now charges the IP only (it sends no mail), so these three
    // are three genuine sends: the initial code plus two resends.
    const c = fakeClient();
    const mail = EMAIL_LIMITS("a@b.de");
    expect(await otpRateLimited(c, mail, now)).toBe(false); // erster Code
    expect(await otpRateLimited(c, mail, now)).toBe(false); // erneut senden
    expect(await otpRateLimited(c, mail, now)).toBe(false); // erneut senden
    expect(await otpRateLimited(c, mail, now)).toBe(true);  // jetzt reicht es
  });

  it("leaves room for a shared office IP", async () => {
    // One NAT, several colleagues trying it after a demo. Two IP charges per
    // registration, so the budget has to carry roughly seven of them.
    const c = fakeClient();
    const ip = IP_LIMITS("1.2.3.4");
    for (let registrierung = 0; registrierung < 7; registrierung++) {
      expect(await otpRateLimited(c, ip, now)).toBe(false); // ensure-user
      expect(await otpRateLimited(c, ip, now)).toBe(false); // signin/email
    }
  });
});
