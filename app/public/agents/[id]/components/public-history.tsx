"use client";

/**
 * PublicHistory — a compact history dropdown for AUTHENTICATED guests
 * (public-agents spec §5, Task 11). Lists the signed-in external user's own
 * sessions for THIS agent; selecting one loads its messages and resumes the
 * conversation in place.
 *
 * Runs only inside <PublicApolloProvider> (it uses Apollo hooks). Anonymous
 * mode never renders it.
 *
 * The GET_AGENT_SESSIONS variables are copied VERBATIM from useChatSessions in
 * app/(application)/chat/hooks.ts (page/limit/filters shape — server RBAC scopes
 * the list to the caller, so no extra user filter is needed), changing only the
 * agent id source. The GET_AGENT_MESSAGES variables and the row-content →
 * UIMessage mapping are copied VERBATIM from the session page loader
 * (app/(application)/chat/[agent]/[session]/page.tsx): fetch page 1 / limit 50
 * sorted createdAt DESC, then `items.map(i => JSON.parse(i.content)).reverse()`
 * so display order is chronological.
 */

import { useApolloClient, useQuery } from "@apollo/client";
import type { UIMessage } from "ai";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSIONS,
} from "@/app/(application)/chat/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Recents cap — same 20 as the internal history rail. */
const RECENTS_LIMIT = 20;

interface HistorySession {
  id: string;
  title?: string | null;
  updatedAt?: string | null;
}

export function PublicHistory({
  agentId,
  onResume,
}: {
  agentId: string;
  onResume: (session: { id: string }, messages: UIMessage[]) => void;
}) {
  const t = useTranslations("publicAgents.chat");
  const client = useApolloClient();
  const [open, setOpen] = React.useState(false);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  // Variables copied verbatim from useChatSessions (chat/hooks.ts), agent id
  // sourced from the public page. Fetch on open so a resumed/created session
  // shows up next time the menu opens.
  const sessionsQuery = useQuery(GET_AGENT_SESSIONS, {
    fetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: RECENTS_LIMIT,
      filters: {
        agent: {
          eq: agentId,
        },
      },
    },
    skip: !open,
  });

  const sessions: HistorySession[] =
    sessionsQuery.data?.agent_sessionsPagination?.items ?? [];

  const handleSelect = React.useCallback(
    async (session: HistorySession) => {
      setLoadingId(session.id);
      try {
        // Variables copied verbatim from the session page loader.
        const res = await client.query({
          query: GET_AGENT_MESSAGES,
          fetchPolicy: "network-only",
          variables: {
            page: 1,
            limit: 50,
            sort: { field: "createdAt", direction: "DESC" },
            filters: {
              session: {
                eq: session.id,
              },
            },
          },
        });
        const items: { content: string }[] =
          res.data?.agent_messagesPagination?.items ?? [];
        // Same mapping as the session page: DESC → reverse to chronological.
        const messages: UIMessage[] = items
          .map((item) => JSON.parse(item.content) as UIMessage)
          .reverse();
        onResume({ id: session.id }, messages);
        setOpen(false);
      } finally {
        setLoadingId(null);
      }
    },
    [client, onResume],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("history")}>
          <History className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t("history")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("history")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sessionsQuery.loading ? (
          <DropdownMenuItem disabled>…</DropdownMenuItem>
        ) : sessions.length === 0 ? (
          <DropdownMenuItem disabled>{t("noSessions")}</DropdownMenuItem>
        ) : (
          sessions.map((session) => (
            <DropdownMenuItem
              key={session.id}
              disabled={loadingId != null}
              onSelect={(event) => {
                // Keep the menu logic in our async handler (prevent the default
                // close so the loading state is visible until messages load).
                event.preventDefault();
                void handleSelect(session);
              }}
            >
              <span className="truncate">
                {session.title?.trim() || t("newChat")}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
