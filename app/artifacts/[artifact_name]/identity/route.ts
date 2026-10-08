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
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!accessRes.ok) {
    return new NextResponse(null, { status: accessRes.status });
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
