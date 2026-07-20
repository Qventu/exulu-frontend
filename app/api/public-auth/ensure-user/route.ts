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
 * - Existing users (any type) are NEVER modified.
 * - The response is identical whether the user existed or was created —
 *   no account-enumeration signal.
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
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [parsed.email],
    );
    if (existing.rows.length > 0) {
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
