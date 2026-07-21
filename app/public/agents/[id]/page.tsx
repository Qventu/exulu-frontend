import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import { fetchPublicAgentMeta, verifyGuestPassword } from "@/lib/api/public-agents";
import { decideGate } from "@/lib/public-agents/gate";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { PublicNote } from "../components/public-note";
import { PublicChatScreen } from "./components/public-chat-screen";
import { GuestPasswordGate } from "./guest-password-gate";

// NO getTranslations here — server pages must not use next-intl/server
// (i18n/config.ts intentionally has no default export / server pathway).
// Terminal-state copy renders client-side in PublicNote.
export const dynamic = "force-dynamic";

export default async function PublicAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const meta = await fetchPublicAgentMeta(id);
  if (meta === "notfound") {
    return <PublicNote kind="notFound" />;
  }
  if (meta === null) {
    return <PublicNote kind="misconfigured" />;
  }

  const pw = (await cookies()).get(`guest_pw_${id}`)?.value;
  const session: any = await getServerSession(await getAuthOptions());
  const decision = decideGate(meta.guest_auth_mode, !!pw, !!session?.user);

  if (decision === "password-gate") {
    return <GuestPasswordGate id={id} />;
  }
  if (decision === "chat-anonymous" && meta.guest_auth_mode === "password") {
    // Re-verify the cookie every load: rotated/removed passwords or
    // unpublished agents send the visitor back to the gate (spec §5.5).
    const ok = await verifyGuestPassword(id, pw!);
    if (!ok) return <GuestPasswordGate id={id} error />;
  }
  if (decision === "auth-redirect") {
    redirect(`/public/agents/${encodeURIComponent(id)}/auth`);
  }

  if (decision === "chat-authenticated") {
    const user = await serverSideAuthCheck();
    if (!user) redirect(`/public/agents/${encodeURIComponent(id)}/auth`);
    return (
      <PublicChatScreen
        meta={meta}
        mode="authenticated"
        userId={(user as { id?: string | number }).id}
      />
    );
  }

  return <PublicChatScreen meta={meta} mode="anonymous" />;
}
