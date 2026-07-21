import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { getAuthOptions } from "@/app/api/auth/[...nextauth]/options";
import {
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
} from "@/app/(application)/chat/queries";
import { fetchPublicAgentMeta, verifyGuestPassword } from "@/lib/api/public-agents";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import { decideGate } from "@/lib/public-agents/gate";
import { serverSideAuthCheck } from "@/lib/server-side-auth-check";
import { PublicNote } from "../components/public-note";
import { PublicChatScreen } from "./components/public-chat-screen";
import { GuestPasswordGate } from "./guest-password-gate";

/**
 * Load a resumed session from ?session=<sid> for an authenticated guest,
 * copying the internal session loader (app/(application)/chat/[agent]/[session]/
 * page.tsx) VERBATIM: fetch the session by id, validate it exists AND belongs
 * to THIS agent (access control is enforced server-side by the JWT), then fetch
 * page 1 / limit 50 of messages sorted createdAt DESC and map
 * `items.map(i => JSON.parse(i.content)).reverse()` so display order is
 * chronological. On any failure/mismatch, return nulls so the page renders a
 * fresh chat (no error page for a bad ?session param).
 */
async function loadResumedSession(
  agentId: string,
  sessionId: string,
): Promise<{ initialSession: any; initialMessages: any[] }> {
  const fresh = { initialSession: null, initialMessages: [] as any[] };
  try {
    const sessionData = await fetchGraphQLServerSide(
      GET_AGENT_SESSION_BY_ID.loc?.source.body || "",
      { id: sessionId },
    );
    const session = sessionData?.agent_sessionById;
    // Validate: exists AND belongs to this agent (JWT scopes RBAC server-side).
    if (!session || session.agent !== agentId) {
      return fresh;
    }

    const messageHistory = await fetchGraphQLServerSide(
      GET_AGENT_MESSAGES.loc?.source.body || "",
      {
        page: 1,
        limit: 50,
        sort: { field: "createdAt", direction: "DESC" },
        filters: { session: { eq: sessionId } },
      },
    );

    let initialMessages: any[] = [];
    if (messageHistory?.agent_messagesPagination) {
      // DESC → reverse to chronological (same as the internal loader).
      initialMessages =
        messageHistory.agent_messagesPagination.items
          ?.map((item: { content: string }) => JSON.parse(item.content))
          .reverse() ?? [];
    }

    return { initialSession: session, initialMessages };
  } catch {
    // Bad param / access denied / transport error → render fresh.
    return fresh;
  }
}

// NO getTranslations here — server pages must not use next-intl/server
// (i18n/config.ts intentionally has no default export / server pathway).
// Terminal-state copy renders client-side in PublicNote.
export const dynamic = "force-dynamic";

export default async function PublicAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: sessionParam } = await searchParams;

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
    // URL-driven session resume: ?session=<sid> loads that session's history
    // server-side; a missing/invalid param renders a fresh chat.
    const { initialSession, initialMessages } = sessionParam
      ? await loadResumedSession(id, sessionParam)
      : { initialSession: null, initialMessages: [] };
    return (
      <PublicChatScreen
        meta={meta}
        mode="authenticated"
        userId={(user as { id?: string | number }).id}
        initialSession={initialSession}
        initialMessages={initialMessages}
      />
    );
  }

  return <PublicChatScreen meta={meta} mode="anonymous" />;
}
