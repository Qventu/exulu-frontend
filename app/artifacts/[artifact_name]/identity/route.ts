import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/**
 * Hands the viewer's credential to an artifact that a platform administrator
 * has explicitly granted the viewer-identity capability.
 *
 * Fetched at runtime by <ArtifactFrame> rather than passed as a prop from the
 * server component: a prop would be serialized into the page's RSC flight
 * data, putting the credential into a document.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artifact_name: string }> },
) {
  const { artifact_name } = await params;
  const backend = process.env.BACKEND;
  if (!backend) {
    return NextResponse.json({ detail: "Server misconfigured." }, { status: 500 });
  }

  const metaRes = await fetch(
    `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/meta`,
    { cache: "no-store" },
  );
  // Covers 404 and 410 (expired) alike: no meta, no grant.
  if (!metaRes.ok) return new NextResponse(null, { status: 404 });
  const meta = await metaRes.json();

  // An artifact without the capability is indistinguishable from one that does
  // not exist. The auth_mode check is load-bearing: a public or password share
  // would otherwise hand a credential to a visitor who never logged in.
  if (meta?.auth_mode !== "regular" || meta?.grant_viewer_identity !== true) {
    return new NextResponse(null, { status: 404 });
  }

  const session = (await getServerSession(await getAuthOptions())) as any;
  const token = session?.user?.jwt as string | undefined;
  if (!token) return new NextResponse(null, { status: 401 });

  const accessRes = await fetch(
    `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/access`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "manual",
    },
  );
  // The access check's contract is exactly 204 (allow), 401, or 403 — nothing
  // else. Trusting `ok` would accept any 2xx, and fetch's default
  // redirect:"follow" means a 3xx that lands on a 200 (an SSO interstitial, a
  // proxy page) would then read as "access granted". Anything outside the
  // contract is reported as 502 rather than forwarded verbatim: forwarding
  // could republish a bare 3xx with no Location, or pass off a backend 500 as
  // this route's own.
  if (accessRes.status === 401 || accessRes.status === 403) {
    return new NextResponse(null, { status: accessRes.status });
  }
  if (accessRes.status !== 204) {
    return new NextResponse(null, { status: 502 });
  }

  return NextResponse.json(
    {
      token,
      // The artifact runs in an opaque origin and cannot read BACKEND or infer
      // where to send requests. Not optional.
      backendOrigin: new URL(backend).origin,
      user: {
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
