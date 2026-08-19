import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthOptions, pool } from "@/app/api/auth/[...nextauth]/options";
import {
  otpRateLimited,
  IP_LIMITS,
  EMAIL_LIMITS,
} from "@/lib/public-auth/otp-rate-limit";

export const dynamic = "force-dynamic";

async function handler(request: any, response: any) {
  const authOptions = await getAuthOptions();
  return await NextAuth(request, response, authOptions);
}

// NextAuth's own sign-in route has no server-side rate limit; the 30-second
// cooldown in the UI is client-side only and trivially bypassed. On a login
// page that is tolerable. On a publicly advertised lead page it is a way to
// bury a third party in mail, so the same counters that guard ensure-user
// guard the send here.
async function limited(req: NextRequest): Promise<Response | null> {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/signin/email")) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // The body is form-encoded and can only be read once, so work on a clone and
  // leave the original stream intact for NextAuth.
  let email = "";
  try {
    const form = await req.clone().formData();
    email = String(form.get("email") ?? "").trim().toLowerCase();
  } catch {
    email = "";
  }

  const counters = email
    ? [...IP_LIMITS(ip), ...EMAIL_LIMITS(email)]
    : IP_LIMITS(ip);

  const client = await pool.connect();
  try {
    if (await otpRateLimited(client, counters)) {
      return NextResponse.json(
        { url: null, error: "RateLimited" },
        { status: 429 },
      );
    }
  } finally {
    client.release();
  }
  return null;
}

export async function GET(req: NextRequest, ctx: any) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  const blocked = await limited(req);
  if (blocked) return blocked;
  return handler(req, ctx);
}
