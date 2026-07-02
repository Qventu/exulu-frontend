import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { Centered, AutoDownload } from "./ui";
import { PasswordGate } from "./password-gate";

export const dynamic = "force-dynamic";

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ artifact_name: string }>;
}) {
  const { artifact_name } = await params;
  const backend = process.env.BACKEND;
  if (!backend) return <Centered title="Server misconfigured" />;

  const metaRes = await fetch(
    `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/meta`,
    { cache: "no-store" },
  );
  if (metaRes.status === 404) notFound();
  if (metaRes.status === 410) return <Centered title="This link has expired" />;
  if (!metaRes.ok) return <Centered title="Something went wrong" />;

  const meta = (await metaRes.json()) as {
    auth_mode: "public" | "password" | "regular";
    filename: string;
    is_html: boolean;
  };
  const contentUrl = `/artifacts/${encodeURIComponent(artifact_name)}/content`;

  const credHeaders: Record<string, string> = {};

  if (meta.auth_mode === "regular") {
    const user = await serverSideAuthCheck();
    if (!user) {
      redirect(`/login?destination=/artifacts/${encodeURIComponent(artifact_name)}`);
    }
    const session: any = await getServerSession(await getAuthOptions());
    const jwt = session?.user?.jwt as string | undefined;
    if (!jwt) return <Centered title="You don't have access to this artifact" />;
    credHeaders["Authorization"] = `Bearer ${jwt}`;
  } else if (meta.auth_mode === "password") {
    const pw = (await cookies()).get(`share_pw_${artifact_name}`)?.value;
    if (!pw) return <PasswordGate name={artifact_name} />;
    credHeaders["x-share-password"] = pw;
  }

  if (meta.is_html) {
    // Fetch content server-side so we can use srcdoc — avoids the browser making
    // a separate request to the content route which would be blocked by the
    // global X-Frame-Options: DENY header.
    const contentRes = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/content`,
      { headers: credHeaders, cache: "no-store" },
    );
    if (contentRes.status === 401) {
      return meta.auth_mode === "password"
        ? <PasswordGate name={artifact_name} error />
        : <Centered title="You don't have access to this artifact" />;
    }
    if (contentRes.status === 403) return <Centered title="You don't have access to this artifact" />;
    if (!contentRes.ok) return <Centered title="Something went wrong" />;
    const html = await contentRes.text();
    return (
      <iframe
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-forms"
        className="h-screen w-screen border-0"
        title={meta.filename}
      />
    );
  }

  // Non-HTML: pre-flight to confirm access before the browser triggers the download.
  if (meta.auth_mode !== "public") {
    const check = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/content`,
      { headers: credHeaders, cache: "no-store" },
    );
    await check.body?.cancel();
    if (check.status === 401) {
      return meta.auth_mode === "password"
        ? <PasswordGate name={artifact_name} error />
        : <Centered title="You don't have access to this artifact" />;
    }
    if (check.status === 403) return <Centered title="You don't have access to this artifact" />;
    if (!check.ok) return <Centered title="Something went wrong" />;
  }

  return <AutoDownload url={contentUrl} filename={meta.filename} />;
}
