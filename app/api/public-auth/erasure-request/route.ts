import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createTransport } from "nodemailer";

import { getAuthOptions, pool } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/**
 * Records an erasure request (Art. 17 GDPR) and notifies the privacy inbox.
 *
 * Deliberately does NOT delete anything. An irreversible deletion behind a
 * single click guarded only by a cookie is a bad trade — on a shared machine
 * one careless moment would be enough. Deletion runs through the existing
 * super_admin route.
 *
 * The notification matters as much as the record: a timestamp in a column
 * nobody watches starts a one-month clock without anyone learning of it. That
 * is worse than having no button at all, because the obligation exists and the
 * trigger is invisible. The column stays the durable record — it survives a
 * failed mail, and operations can query
 * `WHERE erasure_requested_at IS NOT NULL` at any time.
 */
export async function POST() {
  // getAuthOptions is an async FUNCTION, not a constant.
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  const email = (session as { user?: { email?: string } } | null)?.user?.email;
  if (!email) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users
          SET erasure_requested_at = COALESCE(erasure_requested_at, $1),
              "updatedAt" = $1
        WHERE LOWER(email) = LOWER($2)`,
      [new Date(), email],
    );
  } finally {
    client.release();
  }

  // Notify, but never let a mail failure lose the request: the row above is
  // already committed at this point.
  const target = process.env.PRIVACY_CONTACT_EMAIL;
  if (target && process.env.EMAIL_SERVER_HOST) {
    try {
      const transport = createTransport({
        host: process.env.EMAIL_SERVER_HOST,
        port: parseInt(process.env.EMAIL_SERVER_PORT ?? "587", 10),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      });
      await transport.sendMail({
        to: target,
        from: process.env.EMAIL_FROM,
        subject: `Erasure request (Art. 17 GDPR): ${email}`,
        text:
          `The following person has requested erasure of their data via the EU AI Act assistant:\n\n  ${email}\n\n` +
          `Deadline: one month from receipt of this message.\n` +
          `The request is also recorded in the users.erasure_requested_at column.`,
      });
    } catch (error) {
      console.error("[EXULU] erasure notification failed", error);
    }
  } else {
    console.warn(
      "[EXULU] erasure requested but PRIVACY_CONTACT_EMAIL is unset — " +
        "the request is recorded in users.erasure_requested_at only",
    );
  }

  return NextResponse.json({ ok: true });
}
