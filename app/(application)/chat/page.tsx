/**
 * /chat — agent selection (work item 2.3, owner: orchestration;
 * design/pages/chat.md ladder rows 1–5).
 *
 * Server component. Transport unchanged from the legacy page: GET_AGENTS
 * (limit 200, active filter) + the single-agent (item 2) and defaultagent
 * (item 3) redirects. The grid itself no longer pre-creates a session —
 * selecting an agent navigates to /chat/[agent]/new and lazy creation
 * (item 34) covers it (doc-sanctioned behavior change, chat.md row 1).
 *
 * i18n note: next-intl has no server request config in this app (messages are
 * provided client-side via LanguageProvider), so this server page resolves
 * its strings from messages/<locale>.json directly with English fallbacks —
 * same pattern as app/(application)/layout.tsx.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { defaultLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { fetchGraphQLServerSide } from "@/lib/graphql/server";
import type { Agent } from "@/types/models/agent";

import { AgentGridNavigator } from "./components/agent-grid";
import { GET_AGENTS } from "./queries";

async function loadMessages(): Promise<Record<string, unknown>> {
  const cookieStore = await cookies();
  const locale =
    (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  try {
    return (await import(`../../../messages/${locale}.json`)).default;
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

export default async function ChatEmptyPage() {
  const messages = await loadMessages();

  try {
    const agents = await fetchGraphQLServerSide(
      GET_AGENTS.loc?.source.body || "",
      {
        page: 1,
        limit: 200,
        filters: [
          {
            active: {
              eq: true,
            },
          },
        ],
      },
    );

    // Item 4 — no accessible agents.
    if (!agents?.agentsPagination?.items?.length) {
      return (
        <PageShell variant="content">
          <div className="flex min-h-[50dvh] items-center justify-center">
            <EmptyState
              title={msg(
                messages,
                "chat.agentSelect.noAgentsTitle",
                "No agents available",
              )}
              description={msg(
                messages,
                "chat.agentSelect.noAgentsDescription",
                "You don't have access to any agents yet. Please contact your administrator.",
              )}
            />
          </div>
        </PageShell>
      );
    }

    // Item 2 — if only one agent is available, go straight to it.
    if (agents?.agentsPagination?.items?.length === 1) {
      redirect(`/chat/${agents?.agentsPagination?.items?.[0]?.id}`);
    }

    // Item 3 — default agent redirect when set.
    const defaultAgent = agents?.agentsPagination?.items?.find(
      (agent: Agent) => agent.defaultagent,
    );
    if (defaultAgent) {
      redirect(`/chat/${defaultAgent?.id}`);
    }

    // Item 1 — the searchable agent grid.
    return (
      <PageShell variant="content">
        <PageHeader
          title={msg(messages, "chat.agentSelect.title", "Choose an agent")}
          description={msg(
            messages,
            "chat.agentSelect.description",
            "Pick the agent you want to talk to. You can switch at any time.",
          )}
        />
        <AgentGridNavigator />
      </PageShell>
    );
  } catch (error: unknown) {
    // Important: redirects throw — rethrow them or Next renders
    // NEXT_REDIRECT as an error message (item 5).
    if (isRedirectError(error)) {
      throw error;
    }
    return (
      <PageShell variant="content">
        <div className="flex min-h-[50dvh] items-center justify-center">
          <EmptyState
            variant="error"
            title={msg(
              messages,
              "chat.errors.loadTitle",
              "Chat couldn't be loaded",
            )}
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
              label: msg(messages, "chat.errors.tryAgain", "Try again"),
              href: "/chat",
            }}
          />
        </div>
      </PageShell>
    );
  }
}
