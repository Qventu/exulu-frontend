import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artifact_name: string }> },
) {
  const { artifact_name } = await params;
  const backend = process.env.BACKEND;
  const internal = process.env.INTERNAL_SECRET;
  if (!backend || !internal) {
    return NextResponse.json({ detail: "Server misconfigured." }, { status: 500 });
  }

  const metaRes = await fetch(
    `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/meta`,
    { headers: { "internal-key": internal }, cache: "no-store" },
  );
  if (!metaRes.ok) return new NextResponse(null, { status: metaRes.status });
  const meta = await metaRes.json();

  const headers: Record<string, string> = {};
  if (meta.auth_mode === "regular") {
    const session: any = await getServerSession(await getAuthOptions());
    if (!session?.user?.jwt) return new NextResponse(null, { status: 401 });
    headers["Authorization"] = `Bearer ${session.user.jwt}`;
  } else {
    headers["internal-key"] = internal;
    if (meta.auth_mode === "password") {
      const pw = (await cookies()).get(`share_pw_${artifact_name}`)?.value;
      if (!pw) return new NextResponse(null, { status: 401 });
      headers["x-share-password"] = pw;
    }
  }

  const contentRes = await fetch(
    `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/content`,
    { headers, cache: "no-store" },
  );
  if (!contentRes.ok) return new NextResponse(null, { status: contentRes.status });

  const buf = Buffer.from(await contentRes.arrayBuffer());
  const respHeaders = new Headers();
  respHeaders.set(
    "Content-Type",
    contentRes.headers.get("content-type") ?? "application/octet-stream",
  );
  const cd = contentRes.headers.get("content-disposition");
  if (cd) respHeaders.set("Content-Disposition", cd);
  respHeaders.set("Cache-Control", "private, no-store");
  return new NextResponse(buf, { status: 200, headers: respHeaders });
}
