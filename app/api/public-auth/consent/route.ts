import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { getAuthOptions, pool } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/**
 * Read and change the marketing consent of the signed-in user.
 *
 * Authenticated by the NextAuth session cookie — same origin, so it is already
 * attached; no extra token needed.
 *
 * A separate read route is necessary because /api/auth/session returns only
 * id, email and jwt. The consent state is not in there.
 */
async function currentEmail(): Promise<string | null> {
  // getAuthOptions is an async FUNCTION, not a constant — see the existing
  // app/api/feedback/[kind]/route.ts for the same call shape.
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  const email = (session as { user?: { email?: string } } | null)?.user?.email;
  return email ? email.toLowerCase() : null;
}

export async function GET() {
  const email = await currentEmail();
  if (!email) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT email, marketing_consent, marketing_consent_at
         FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    const row = res.rows[0];
    if (!row) {
      return NextResponse.json({ detail: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      email: row.email,
      marketing_consent: Boolean(row.marketing_consent),
      marketing_consent_at: row.marketing_consent_at,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const email = await currentEmail();
  if (!email) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const value = (body as { marketing_consent?: unknown } | null)?.marketing_consent;
  if (typeof value !== "boolean") {
    return NextResponse.json(
      { detail: "marketing_consent must be a boolean." },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    if (value) {
      // Granting: keep the ORIGINAL grant time if there is one, and clear any
      // previous withdrawal.
      await client.query(
        `UPDATE users
            SET marketing_consent = true,
                marketing_consent_at = COALESCE(marketing_consent_at, $1),
                marketing_consent_withdrawn_at = NULL,
                "updatedAt" = $1
          WHERE LOWER(email) = LOWER($2)`,
        [new Date(), email],
      );
    } else {
      // Withdrawing: record WHEN, and deliberately leave marketing_consent_at
      // standing. Overwriting it would destroy the grant time and with it the
      // ability to show the order of events if someone later claims they were
      // mailed after withdrawing.
      await client.query(
        `UPDATE users
            SET marketing_consent = false,
                marketing_consent_withdrawn_at = $1,
                "updatedAt" = $1
          WHERE LOWER(email) = LOWER($2)`,
        [new Date(), email],
      );
    }
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
