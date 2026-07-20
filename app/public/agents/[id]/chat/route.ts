import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/**
 * Same-origin SSE proxy (spec §5.3): attaches credentials server-side
 * (httpOnly password cookie → x-guest-password; session JWT → Authorization)
 * and pipes the backend stream through. The backend independently enforces
 * gating, rate limits, and caps — this is a credential translator, not a gate.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backend = process.env.BACKEND;
  if (!backend) {
    return NextResponse.json({ detail: "Server misconfigured." }, { status: 500 });
  }

  const metaRes = await fetch(
    `${backend}/public-agents/${encodeURIComponent(id)}/meta`,
    { cache: "no-store" },
  );
  if (!metaRes.ok) return new NextResponse(null, { status: metaRes.status });
  const meta = (await metaRes.json()) as {
    slug: string;
    guest_auth_mode: "public" | "password" | "regular";
  };
  if (!meta.slug) {
    return NextResponse.json({ detail: "Agent has no chat route." }, { status: 500 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Stream: "true",
  };
  if (meta.guest_auth_mode === "regular") {
    const session: any = await getServerSession(await getAuthOptions());
    if (!session?.user?.jwt) return new NextResponse(null, { status: 401 });
    headers["Authorization"] = `Bearer ${session.user.jwt}`;
    const sessionHeader = req.headers.get("session");
    if (sessionHeader) headers["Session"] = sessionHeader;
  } else if (meta.guest_auth_mode === "password") {
    const pw = (await cookies()).get(`guest_pw_${id}`)?.value;
    if (!pw) return new NextResponse(null, { status: 401 });
    headers["x-guest-password"] = pw;
  }

  const body = await req.text();
  const upstream = await fetch(`${backend}${meta.slug}/${encodeURIComponent(id)}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  const respHeaders = new Headers();
  respHeaders.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "text/event-stream",
  );
  respHeaders.set("Cache-Control", "no-store");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
