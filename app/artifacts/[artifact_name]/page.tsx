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

  if (meta.auth_mode === "regular") {
    const user = await serverSideAuthCheck();
    if (!user) {
      redirect(`/login?destination=/artifacts/${encodeURIComponent(artifact_name)}`);
    }
    // Pre-flight: confirm the viewer is RBAC-authorized before rendering.
    // Without this, a denied viewer of an HTML artifact would get a broken iframe.
    const session: any = await getServerSession(await getAuthOptions());
    const jwt = session?.user?.jwt as string | undefined;
    const check = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/content`,
      { headers: { Authorization: `Bearer ${jwt ?? ""}` }, cache: "no-store" },
    );
    await check.body?.cancel();
    if (check.status === 401 || check.status === 403) {
      return <Centered title="You don't have access to this artifact" />;
    }
    if (!check.ok) return <Centered title="Something went wrong" />;
  }

  if (meta.auth_mode === "password") {
    const pw = (await cookies()).get(`share_pw_${artifact_name}`)?.value;
    if (!pw) return <PasswordGate name={artifact_name} />;
    // Validate before rendering so a wrong password re-prompts cleanly rather
    // than showing a broken iframe / failed download. (One extra fetch in the
    // password path — acceptable; artifacts are modest in size.)
    const check = await fetch(
      `${backend}/shared-artifacts/${encodeURIComponent(artifact_name)}/content`,
      { headers: { "x-share-password": pw }, cache: "no-store" },
    );
    await check.body?.cancel();
    if (check.status === 401) return <PasswordGate name={artifact_name} error />;
    if (!check.ok) return <Centered title="Something went wrong" />;
  }

  if (meta.is_html) {
    return (
      <iframe
        src={contentUrl}
        sandbox="allow-scripts allow-popups allow-forms"
        className="h-screen w-screen border-0"
        title={meta.filename}
      />
    );
  }

  return <AutoDownload url={contentUrl} filename={meta.filename} />;
}
