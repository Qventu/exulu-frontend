/**
 * /chat/[agent]/[session] (incl. the virtual "new") — work item 2.3, owner:
 * orchestration.
 *
 * Server fetch sequence is preserved EXACTLY from the legacy page (untouchable
 * transport): session → first 50 messages → the PROJECT-SCOPED agent fetch
 * (GET_AGENT_BY_ID with `project: sessionData.agent_sessionById.project`) —
 * project scoping affects what the agent resolver returns for project-linked
 * sessions and MUST be kept (chat.md §4 dependencies). The dead client-side
 * projectQuery (U15) is NOT recreated.
 *
 * Session/agent-not-found and load errors render the shared EmptyState error
 * variant (item 7). Renders SessionScreen — the decomposed chat surface.
 */
import { cookies } from "next/headers";

import { EmptyState } from "@/components/primitives/empty-state";
import { defaultLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";

import { SessionScreen } from "../../components/session-screen";
import {
  GET_AGENT_BY_ID,
  GET_AGENT_MESSAGES,
  GET_AGENT_SESSION_BY_ID,
} from "../../queries";

export const dynamic = "force-dynamic";

async function loadMessages(): Promise<Record<string, unknown>> {
  const cookieStore = await cookies();
  const locale =
    (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  try {
    return (await import(`../../../../../messages/${locale}.json`)).default;
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

function CenteredError({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center p-4">
      <EmptyState
        variant="error"
        title={title}
        description={description}
        action={{ label: actionLabel, href: actionHref }}
      />
    </div>
  );
}

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ session: string; agent: string }>;
}) {
  const { session, agent } = await params;
  const messages = await loadMessages();
  const backToNew = {
    actionLabel: msg(messages, "chat.errors.newChat", "Start a new chat"),
    actionHref: `/chat/${agent}/new`,
  };

  try {
    if (session === "new") {
      const agentData = await fetchGraphQLServerSide(
        GET_AGENT_BY_ID.loc?.source.body || "",
        {
          id: agent,
        },
      );

      if (!agentData?.agentById) {
        return (
          <CenteredError
            title={msg(messages, "chat.errors.agentNotFound", "Agent not found")}
            description={msg(
              messages,
              "chat.errors.agentNotFoundDescription",
              "This agent doesn't exist or you don't have access to it.",
            )}
            actionLabel={msg(
              messages,
              "chat.errors.backToAgents",
              "Back to agents",
            )}
            actionHref="/chat"
          />
        );
      }

      return (
        <SessionScreen
          initialSession={null}
          agent={agentData.agentById}
          initialMessages={[]}
        />
      );
    }

    // Fetch session data first
    const sessionData = await fetchGraphQLServerSide(
      GET_AGENT_SESSION_BY_ID.loc?.source.body || "",
      { id: session },
    );

    const messageHistory = await fetchGraphQLServerSide(
      GET_AGENT_MESSAGES.loc?.source.body || "",
      {
        page: 1,
        limit: 50,
        sort: { field: "createdAt", direction: "DESC" },
        filters: {
          session: {
            eq: session,
          },
        },
      },
    );

    let initialMessages = [];

    if (messageHistory?.agent_messagesPagination) {
      // Query returns newest-first (DESC); reverse so display order is chronological.
      initialMessages = messageHistory?.agent_messagesPagination?.items
        ?.map((item: { content: string }) => JSON.parse(item.content))
        .reverse();
    }

    if (!sessionData?.agent_sessionById) {
      return (
        <CenteredError
          title={msg(
            messages,
            "chat.errors.sessionNotFound",
            "Conversation not found",
          )}
          description={msg(
            messages,
            "chat.errors.sessionNotFoundDescription",
            "This conversation doesn't exist or you don't have access to it.",
          )}
          {...backToNew}
        />
      );
    }

    // Fetch agent data with project context if available — the project-scoped
    // agent fetch is untouchable transport (chat.md §4 dependencies).
    const agentData = await fetchGraphQLServerSide(
      GET_AGENT_BY_ID.loc?.source.body || "",
      {
        id: agent,
        project: sessionData.agent_sessionById.project || undefined,
      },
    );

    if (!agentData?.agentById) {
      return (
        <CenteredError
          title={msg(messages, "chat.errors.agentNotFound", "Agent not found")}
          description={msg(
            messages,
            "chat.errors.agentNotFoundDescription",
            "This agent doesn't exist or you don't have access to it.",
          )}
          actionLabel={msg(
            messages,
            "chat.errors.backToAgents",
            "Back to agents",
          )}
          actionHref="/chat"
        />
      );
    }

    return (
      <SessionScreen
        initialSession={sessionData.agent_sessionById}
        agent={agentData.agentById}
        initialMessages={initialMessages}
      />
    );
  } catch (error) {
    return (
      <CenteredError
        title={msg(messages, "chat.errors.loadTitle", "Chat couldn't be loaded")}
        description={
          error instanceof Error
            ? error.message
            : msg(
                messages,
                "chat.errors.unexpected",
                "An unexpected error occurred. Please try again.",
              )
        }
        {...backToNew}
      />
    );
  }
}
