/**
 * /chat/[agent] layout (work item 2.3, owner: orchestration).
 *
 * Server agent fetch unchanged (GET_AGENT_BY_ID — now imported from the
 * colocated chat/queries.ts). Renders the client ChatShell (h-dvh full-bleed
 * host + ChatShellContext) wrapping the HistoryRail (owner: sessions — it
 * renders BOTH the ≥lg docked rail and the <lg left Sheet) and the route
 * children, so history exists on session AND search routes (chat.md U2 fix).
 *
 * Agent-not-found / load errors render the shared EmptyState error variant
 * (item 7) instead of the legacy bare Alert.
 */
import { cookies } from "next/headers";
import * as React from "react";

import { EmptyState } from "@/components/primitives/empty-state";
import { defaultLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";

import { ChatShell } from "../components/chat-shell";
import { HistoryRail } from "../components/history-rail";
import { GET_AGENT_BY_ID } from "../queries";

async function loadMessages(): Promise<Record<string, unknown>> {
  const cookieStore = await cookies();
  const locale =
    (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  try {
    return (await import(`../../../../messages/${locale}.json`)).default;
  } catch {
    return {};
  }
}

function msg(
  messages: Record<string, unknown>,
  path: string,
  fallback: string,
): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      messages,
    );
  return typeof value === "string" ? value : fallback;
}

export default async function ChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agent: string }>;
}) {
  const messages = await loadMessages();

  try {
    const { agent } = await params;
    const agentData = await fetchGraphQLServerSide(
      GET_AGENT_BY_ID.loc?.source.body || "",
      { id: agent },
    );

    if (!agentData?.agentById) {
      throw new Error("Agent with id " + agent + " not found");
    }

    return (
      <ChatShell agent={agentData.agentById}>
        <HistoryRail agent={agentData.agentById} />
        {children}
      </ChatShell>
    );
  } catch (error: unknown) {
    // Item 7 — agent-not-found / generic load error.
    return (
      <div className="flex h-full min-h-[50dvh] w-full items-center justify-center p-4">
        <EmptyState
          variant="error"
          title={msg(messages, "chat.errors.agentNotFound", "Agent not found")}
          description={
            error instanceof Error
              ? error.message
              : msg(
                  messages,
                  "chat.errors.unexpected",
                  "An unexpected error occurred. Please try again.",
                )
          }
          action={{
            label: msg(messages, "chat.errors.backToAgents", "Back to agents"),
            href: "/chat",
          }}
        />
      </div>
    );
  }
}
