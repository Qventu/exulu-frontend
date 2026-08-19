/**
 * Distributed rate limiting for the public OTP routes (spec §7.1).
 *
 * Counts in Postgres, not in memory. The existing in-memory limiter in
 * rate-limit.ts is a plain Map in module scope: useless across replicas and
 * reset by every cold start, so an attacker spreading requests over workers
 * walks straight past it.
 *
 * Redis is not an option here. This process is the Next.js frontend; it has no
 * Redis client, and the middleware runs on the Edge runtime where TCP sockets
 * do not exist. The Postgres pool is already here and already shared.
 *
 * The table is owned and created by the backend — see the lead-capture backend
 * plan. This module only reads and writes rows.
 */

export interface Counter {
  key: string;
  limit: number;
  windowMs: number;
}

const MIN_15 = 15 * 60_000;
const HOUR = 60 * 60_000;

/**
 * Reads a limit from the environment, falling back to the production value.
 *
 * These exist because the production numbers are unusable while developing:
 * five sends per address per hour is right for a real person, who needs one
 * code and maybe a resend — but someone debugging the flow burns one per
 * attempt and is locked out after five, for an hour, by their own protection.
 * The alternative was deleting counter rows by hand between attempts.
 *
 * Raising these in production weakens a real control, so the defaults are the
 * strict values and any change has to be a deliberate act.
 */
const grenze = (name: string, vorgabe: number): number => {
  const roh = process.env[name];
  if (!roh) return vorgabe;
  const wert = Number.parseInt(roh, 10);
  // A typo must not silently disable the limiter — fall back loudly instead.
  if (!Number.isFinite(wert) || wert <= 0) {
    console.warn(`[EXULU] ignoring invalid ${name}="${roh}", using ${vorgabe}`);
    return vorgabe;
  }
  return wert;
};

/**
 * Per-IP budget: protects the service from one noisy source.
 *
 * Note that ONE registration spends TWO of these: the client calls
 * ensure-user and then signin/email, and both guard on the IP. The limits are
 * sized accordingly — 15 per quarter hour is roughly seven registrations, which
 * a single office behind one NAT can plausibly need after a demo, while still
 * bounding how much junk one address can push into the users table.
 */
export const IP_LIMITS = (ip: string): Counter[] => [
  { key: `ip:${ip}:15m`, limit: grenze("OTP_LIMIT_IP_15M", 15), windowMs: MIN_15 },
  { key: `ip:${ip}:1h`, limit: grenze("OTP_LIMIT_IP_1H", 40), windowMs: HOUR },
];

/**
 * Per-address budget: protects a THIRD PARTY from being buried in mail.
 *
 * Deliberately tighter than the IP budget. An attacker controls many IPs but
 * cannot change their victim's address, so this is the dimension that actually
 * caps how often one person can be written to.
 *
 * Counted ONLY where mail is actually sent — see the note on that below. The
 * three per quarter hour are therefore three genuine sends: the initial code
 * plus two resends, which is what a person needs when the first mail is slow.
 */
export const EMAIL_LIMITS = (email: string): Counter[] => [
  {
    key: `email:${email.toLowerCase()}:15m`,
    limit: grenze("OTP_LIMIT_EMAIL_15M", 3),
    windowMs: MIN_15,
  },
  {
    key: `email:${email.toLowerCase()}:1h`,
    limit: grenze("OTP_LIMIT_EMAIL_1H", 5),
    windowMs: HOUR,
  },
];

interface Queryable {
  query: (sql: string, params: unknown[]) => Promise<{ rows: any[] }>;
}

// One statement per counter. The window is reset in place when the stored
// start has aged out, so stale rows need no cleanup job.
const SQL = `
  INSERT INTO otp_send_attempts (key, count, window_start, "createdAt", "updatedAt")
  VALUES ($1, 1, to_timestamp($2 / 1000.0), now(), now())
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN $2 - (EXTRACT(EPOCH FROM otp_send_attempts.window_start) * 1000) >= $3
          THEN 1
          ELSE otp_send_attempts.count + 1
        END,
        window_start = CASE
          WHEN $2 - (EXTRACT(EPOCH FROM otp_send_attempts.window_start) * 1000) >= $3
          THEN to_timestamp($2 / 1000.0)
          ELSE otp_send_attempts.window_start
        END,
        "updatedAt" = now()
  RETURNING count
`;

/**
 * Increments every counter and reports whether ANY of them is over its limit.
 *
 * All counters are incremented even once one is known to be over, so the
 * numbers stay honest — a caller who keeps hammering is counted, not ignored.
 */
export async function otpRateLimited(
  client: Queryable,
  counters: Counter[],
  now: number = Date.now(),
): Promise<boolean> {
  try {
    let exceeded = false;
    for (const c of counters) {
      const res = await client.query(SQL, [c.key, now, c.windowMs]);
      const count = Number(res.rows[0]?.count ?? 0);
      if (count > c.limit) exceeded = true;
    }
    return exceeded;
  } catch (error) {
    // Fail OPEN. Failing closed would turn a database hiccup into a complete
    // registration outage; failing open costs at most one unthrottled window.
    console.error("[EXULU] otp rate limit check failed, allowing", error);
    return false;
  }
}
