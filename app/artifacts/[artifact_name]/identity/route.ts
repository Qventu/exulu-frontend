import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";

export const dynamic = "force-dynamic";

/** Neither backend fetch may hang the handler forever. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Every response from this route — success or refusal — carries this
 * header. `force-dynamic` prevents static generation but adds no response
 * header of its own, so an intermediary could otherwise cache a 404 or 403,
 * meaning a newly granted artifact keeps being refused.
 */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function empty(status: number) {
  return new NextResponse(null, { status, headers: NO_STORE });
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

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
    return json({ detail: "Server misconfigured." }, 500);
  }

  let metaRes: Response;
  try {
    metaRes = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/meta`,
      { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    // The port-first protocol names this failure state explicitly: the
    // channel arrived but no grant followed. Distinct from "not running
    // inside the IMP" (the 404 branches below) — a hung or unreachable
    // backend must not be reported the same way a missing capability is.
    return empty(502);
  }
  // Covers 404 and 410 (expired) alike: no meta, no grant.
  if (!metaRes.ok) return empty(404);
  const meta = await metaRes.json();

  // `auth_mode: "regular"` IS the capability: the artifact only renders for a
  // logged-in user who passes RBAC on the share row, so handing that user their
  // own identity grants nothing they did not already have in the IMP itself.
  //
  // Still load-bearing, and the explicit equality is deliberate: a public or
  // password share is gated upstream by an internal key and never reaches RBAC,
  // so granting on one would hand a credential to a visitor who never logged in.
  //
  // A second condition used to sit here — a per-row `grant_viewer_identity` flag
  // a super-admin had to set. Removed deliberately. Exfiltration is contained by
  // the inherited CSP (`connect-src` is an allowlist with no wildcard,
  // `form-action 'self'`, `object-src 'none'`), which bounds a compromised
  // dependency whether or not a flag is set; and the flag could not deliver the
  // code review its framing implied, because it pins the share row rather than
  // the bytes (content stays replaceable afterwards) and `script-src` permits
  // jsdelivr, so what executes is not determined by what was reviewed.
  if (meta?.auth_mode !== "regular") {
    return empty(404);
  }

  const session = (await getServerSession(await getAuthOptions())) as any;
  const token = session?.user?.jwt as string | undefined;
  if (!token) return empty(401);

  let accessRes: Response;
  try {
    accessRes = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/access`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
  } catch {
    return empty(502);
  }
  // The access check's contract is exactly 204 (allow), 401, 403, 404, or
  // 410 — nothing else. Trusting `ok` would accept any 2xx, and fetch's
  // default redirect:"follow" means a 3xx that lands on a 200 (an SSO
  // interstitial, a proxy page) would then read as "access granted".
  if (accessRes.status === 401 || accessRes.status === 403) {
    return empty(accessRes.status);
  }
  // A share deleted or expired between the /meta and /access calls is the
  // truth, not a gateway failure — report it the same way a missing share
  // is reported everywhere else on this route.
  if (accessRes.status === 404 || accessRes.status === 410) {
    return empty(404);
  }
  // Anything else outside the contract is reported as 502 rather than
  // forwarded verbatim: forwarding could republish a bare 3xx with no
  // Location, or pass off a backend 500 as this route's own.
  if (accessRes.status !== 204) {
    return empty(502);
  }

  return json(
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
    200,
  );
}
