/**
 * /artifacts/open/[name] — the in-shell artifact viewer.
 *
 * The published share route (`app/artifacts/[artifact_name]`) renders an
 * artifact full-screen with its own root layout, for people who follow a
 * link. This page renders the same artifact inside the IMP shell (sidebar,
 * top bar, nav) and otherwise follows the share route step for step: meta
 * first, then the viewer's credential (session JWT for `regular`, the
 * share-password cookie for `password`, nothing for `public`), then the HTML
 * is fetched server-side so the frame can use `srcDoc` — the global
 * X-Frame-Options: DENY would block a frame that loads the content route
 * itself. Non-HTML artifacts are fetched by the client component as a blob.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { withFragmentNavFix } from "@/lib/artifacts/fragment-nav";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";

import { ArtifactViewer, type ViewerStatus } from "./viewer-client";

export const dynamic = "force-dynamic";

type Meta = {
  auth_mode: "public" | "password" | "regular";
  filename: string;
  is_html: boolean;
};

export default async function ArtifactOpenPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const backend = process.env.BACKEND;
  if (!backend) return <ArtifactViewer name={name} filename={name} authMode="regular" status="error" />;

  const base = `${backend}/shared-artifacts/${encodeURIComponent(name)}`;
  const metaRes = await fetch(`${base}/meta`, { cache: "no-store" });
  const failed = (status: ViewerStatus) => <ArtifactViewer name={name} filename={name} authMode="regular" status={status} />;
  if (metaRes.status === 404) return failed("notFound");
  if (metaRes.status === 410) return failed("expired");
  if (!metaRes.ok) return failed("error");
  const meta = (await metaRes.json()) as Meta;

  const credHeaders: Record<string, string> = {};
  if (meta.auth_mode === "regular") {
    const user = await serverSideAuthCheck();
    if (!user) redirect(`/login?destination=/artifacts/open/${encodeURIComponent(name)}`);
    const session: any = await getServerSession(await getAuthOptions());
    const jwt = session?.user?.jwt as string | undefined;
    if (!jwt) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="noAccess" />;
    credHeaders["Authorization"] = `Bearer ${jwt}`;
  } else if (meta.auth_mode === "password") {
    const pw = (await cookies()).get(`share_pw_${name}`)?.value;
    // Without the share-password cookie the viewer cannot read the content;
    // the share link carries the password gate, so the viewer points there.
    if (!pw) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="password" />;
    credHeaders["x-share-password"] = pw;
  }

  const contentStatus = (status: number): ViewerStatus | null => {
    if (status === 401) return meta.auth_mode === "password" ? "password" : "noAccess";
    if (status === 403) return "noAccess";
    if (status === 404) return "notFound";
    if (status === 410) return "expired";
    return null;
  };

  if (meta.is_html) {
    const contentRes = await fetch(`${base}/content`, { headers: credHeaders, cache: "no-store" });
    if (!contentRes.ok) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status={contentStatus(contentRes.status) ?? "error"} />;
    const html = await contentRes.text();
    return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="ready" html={withFragmentNavFix(html)} />;
  }

  // Non-HTML: confirm access here so the client never starts a blob fetch
  // (or a download) that is going to be refused.
  if (meta.auth_mode !== "public") {
    const check = await fetch(`${base}/content`, { headers: credHeaders, cache: "no-store" });
    await check.body?.cancel();
    if (!check.ok) return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status={contentStatus(check.status) ?? "error"} />;
  }
  return <ArtifactViewer name={name} filename={meta.filename} authMode={meta.auth_mode} status="ready" />;
}
