import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/app/api/auth/[...nextauth]/options";
import { validateEnsureUserInput } from "@/lib/public-auth/ensure-user-core";
import { checkHoneypot, checkTiming } from "@/lib/public-auth/consent-core";
import {
  otpRateLimited,
  IP_LIMITS,
} from "@/lib/public-auth/otp-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Creates a `type='external'` user row if the email is unknown (spec §4.2).
 * - Registration requires SMTP: without EMAIL_SERVER_HOST there is no OTP
 *   verification path, so respond 503 (the UI hides signup then anyway).
 * - Existing rows are left untouched, with ONE exception (see below): an
 *   external row that is still unverified may have its password hash replaced.
 * - The response is byte-identical `{ ok: true }` whether the user existed, was
 *   created, or had its unverified password updated — no enumeration signal.
 * - Bot-classified requests also receive `{ ok: true }` — a bot must not learn
 *   it was spotted, and a misclassified human must not see an error.
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

  // Missing x-forwarded-for (not behind a proxy) buckets all clients under
  // "unknown" — intentional; header is present in production behind any
  // reverse proxy.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  // Cheap bot signals BEFORE any database work. The response is the ordinary
  // success body: a bot must not learn that it was spotted, and — because the
  // signals are weak by construction — a misclassified human must not be shown
  // an error either. See consent-core.ts on why these fail open.
  if (checkHoneypot(body) === "bot") {
    return NextResponse.json({ ok: true });
  }
  const renderedAt = (body as { rendered_at?: unknown } | null)?.rendered_at;
  if (checkTiming(renderedAt) === "bot") {
    return NextResponse.json({ ok: true });
  }

  const parsed = validateEnsureUserInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ detail: parsed.error }, { status: parsed.status });
  }

  const client = await pool.connect();
  try {
    // IP only — deliberately NOT the email budget.
    //
    // That budget exists to stop a third party being buried in mail, and this
    // route sends no mail: it creates or touches a row. The route that actually
    // sends is signin/email, and that is where the address is charged.
    //
    // Counting here too was a real defect, not a nicety. The client calls
    // ensure-user and signin/email back to back, so a single registration spent
    // TWO of three per quarter hour — one attempt plus a resend and the person
    // was locked out of their own signup, with a 429 they could do nothing
    // about. Filling the users table with junk is what the IP budget is for.
    //
    // Runs after validation so a malformed body cannot burn anyone's budget.
    if (await otpRateLimited(client, IP_LIMITS(ip))) {
      return NextResponse.json(
        { detail: "Too many requests." },
        { status: 429 },
      );
    }

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

      // Consent is only ever GRANTED here, never withdrawn. A returning user
      // who ticks the box again has it recorded; an unticked box leaves an
      // earlier consent untouched. Withdrawal is a separate, deliberate action
      // (the toggle under "Meine Daten") — not a forgotten checkbox.

      // A returning user who registered before consent was collected (Exulu's
      // public-agents pages show no checkbox) may be giving explicit processing
      // consent for the first time right now. Record it — COALESCE so an
      // existing timestamp is never moved.
      if (parsed.processingConsent) {
        await client.query(
          `UPDATE users
              SET processing_consent_at = COALESCE(processing_consent_at, $1),
                  "updatedAt" = $1
            WHERE id = $2`,
          [new Date(), row.id],
        );
      }

      // consent_version deliberately stores the most recently accepted wording,
      // not the first. So it may advance while marketing_consent_at stays at the
      // original grant time, and the pair becomes approximate once several
      // versions circulate. A gapless history — which version was accepted when
      // — needs the consent-events table named in spec §5. Today only one
      // version exists ("2026-08-18"), so the case is not yet reachable.
      //
      // This note lives in TypeScript, not inside the SQL string. A stray "//"
      // in that string once reached Postgres verbatim and failed the whole
      // statement with a syntax error at runtime — a comment for maintainers has
      // no business being shipped over the wire on every registration.
      if (parsed.marketingConsent) {
        await client.query(
          `UPDATE users
              SET marketing_consent = true,
                  marketing_consent_at = COALESCE(marketing_consent_at, $1),
                  marketing_consent_withdrawn_at = NULL,
                  consent_version = COALESCE($2, consent_version),
                  "updatedAt" = $1
            WHERE id = $3`,
          [new Date(), parsed.consentVersion || null, row.id],
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

    const teamResult = await client.query(
      "SELECT id FROM teams WHERE name = $1",
      ["external"],
    );
    const externalTeam = teamResult.rows[0];
    if (!externalTeam) {
      // Hard stop rather than inserting without a team. A user with no team
      // emits no team_name_* tag, and LiteLLM's tag filtering then finds no
      // permitted deployment — they would register successfully and every
      // answer would fail with 401. Better to refuse now, loudly.
      console.error("[EXULU] external team missing — create it in the admin UI");
      return NextResponse.json(
        { detail: "Registration is unavailable." },
        { status: 503 },
      );
    }

    const passwordHash = parsed.password
      ? await bcrypt.hash(parsed.password, 12)
      : null;
    const now = new Date();
    const displayName = [parsed.firstname, parsed.lastname]
      .filter(Boolean)
      .join(" ");
    await client.query(
      `INSERT INTO users (
         "email", "name", "firstname", "lastname", "password",
         "createdAt", "updatedAt", "type", "super_admin", "role", "team",
         "processing_consent_at", "marketing_consent", "marketing_consent_at",
         "signup_source", "consent_version"
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        parsed.email,
        displayName,
        parsed.firstname,
        parsed.lastname,
        passwordHash,
        now,
        now,
        "external",
        false,
        externalRole.id,
        externalTeam.id,
        // Only write a timestamp when the user was actually shown and ticked
        // the processing-consent checkbox. null = "not asked", which is
        // auditable; a fabricated timestamp for an unasked consent is not.
        parsed.processingConsent ? now : null,
        parsed.marketingConsent,
        parsed.marketingConsent ? now : null,
        parsed.source || null,
        parsed.consentVersion || null,
      ],
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
