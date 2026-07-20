import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { fetchPublicAgentMeta } from "@/lib/api/public-agents";
import { AuthShell } from "@/app/(authentication)/components/auth-shell";
import { PublicAuth } from "./public-auth";

export const dynamic = "force-dynamic";

export default async function PublicAgentAuthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = await fetchPublicAgentMeta(id);
  const agentUrl = `/public/agents/${encodeURIComponent(id)}`;

  // Only login-mode agents have an auth page; everything else goes back.
  if (meta === "notfound" || meta === null || meta.guest_auth_mode !== "regular") {
    redirect(agentUrl);
  }

  const session: any = await getServerSession(await getAuthOptions());
  if (session?.user) redirect(agentUrl);

  const backend = process.env.BACKEND || "";
  const coverUrl = meta.guest_has_cover
    ? `${backend}/public-agents/${encodeURIComponent(id)}/cover`
    : backend
      ? `${backend}/cover.jpg`
      : undefined;

  return (
    <AuthShell coverUrl={coverUrl} termsHref={process.env.TERMS_URL || undefined}>
      <PublicAuth agentName={meta.name} destination={agentUrl} />
    </AuthShell>
  );
}
