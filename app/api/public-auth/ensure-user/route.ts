import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/app/api/auth/[...nextauth]/options";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";
import { ensureUserRateLimited } from "@/lib/public-auth/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Creates a `type='external'` user row if the email is unknown (spec §4.2).
 * - Registration requires SMTP: without EMAIL_SERVER_HOST there is no OTP
 *   verification path, so respond 503 (the UI hides signup then anyway).
 * - Existing rows are left untouched, with ONE exception (see below): an
 *   external row that is still unverified may have its password hash replaced.
 * - The response is byte-identical `{ ok: true }` whether the user existed, was
 *   created, or had its unverified password updated — no enumeration signal.
 *
 * Last-unverified-registrant-wins (pre-hijack close): previously existing rows
 * were NEVER modified, so an attacker could pre-register a victim's email with
 * the attacker's password. The victim's own later registration silently
 * discarded the victim's password, and once the victim OTP-verified, the
 * ATTACKER's password owned a now-verified account. Fix: when the existing row
 * is `type='external'` AND still unverified ("emailVerified" IS NULL) AND a
 * password is supplied, overwrite its password hash. This is safe because
 * verification via OTP still proves ownership — whoever actually receives the
 * code and verifies is the legitimate owner — and, combined with Fix 2
 * (unverified external rows cannot credential-login), unverified rows stay
 * inert until that OTP proof lands. So the last registrant to set a password
 * before verification simply wins, and only the real inbox owner can activate
 * the account.
 */
export async function POST(req: NextRequest) {
  if (!process.env.EMAIL_SERVER_HOST) {
    return NextResponse.json(
      { detail: "Registration is unavailable." },
      { status: 503 },
    );
  }
  // Missing x-forwarded-for (not behind a proxy) buckets all clients under "unknown" — intentional; header is present in production behind any reverse proxy.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (ensureUserRateLimited(ip)) {
    return NextResponse.json({ detail: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = validateEnsureUserInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ detail: parsed.error }, { status: parsed.status });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT id, type, "emailVerified" FROM users WHERE LOWER(email) = LOWER($1)',
      [parsed.email],
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Last-unverified-registrant-wins: overwrite the password hash ONLY when
      // the row is an unverified external account and a password was supplied.
      // All other existing rows (internal, or already-verified external) remain
      // untouched. Response stays byte-identical either way.
      if (
        row.type === "external" &&
        row.emailVerified == null &&
        parsed.password
      ) {
        const passwordHash = await bcrypt.hash(parsed.password, 12);
        await client.query(
          "UPDATE users SET password = $1, \"updatedAt\" = $2 WHERE id = $3",
          [passwordHash, new Date(), row.id],
        );
      }
      return NextResponse.json({ ok: true });
    }
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["external"],
    );
    const externalRole = roleResult.rows[0];
    if (!externalRole) {
      console.error("[EXULU] external role missing — backend seed not run?");
      return NextResponse.json(
        { detail: "Registration is unavailable." },
        { status: 503 },
      );
    }
    const passwordHash = parsed.password
      ? await bcrypt.hash(parsed.password, 12)
      : null;
    await client.query(
      `INSERT INTO users ("email", "name", "password", "createdAt", "updatedAt", "type", "super_admin", "role")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [parsed.email, "", passwordHash, new Date(), new Date(), "external", false, externalRole.id],
    );
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") {
      // Concurrent duplicate insert — same outcome as "already existed".
      return NextResponse.json({ ok: true });
    }
    console.error("[EXULU] ensure-user failed", error);
    return NextResponse.json({ detail: "Something went wrong." }, { status: 500 });
  } finally {
    client.release();
  }
}
