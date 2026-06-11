"use client";

/**
 * AgentGrid — searchable active-agent grid (work item 2.3, owner:
 * orchestration; design/pages/chat.md ladder row 1).
 *
 * Consumed by the /chat page (via AgentGridNavigator) AND the sessions
 * owner's agent-switcher-dialog. `onSelect(agent)` ONLY — navigation is the
 * caller's job and the grid NEVER pre-creates a session (lazy creation,
 * item 34, happens on first send). This replaces the /chat usage of
 * components/agent-selection-dialog.tsx (the legacy file stays —
 * components/project-details.tsx still imports it; the projects work item
 * retires it).
 */

import { useQuery } from "@apollo/client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";

import AgentVisual from "@/components/lottie";
import { EmptyState } from "@/components/primitives/empty-state";
import { Toolbar } from "@/components/primitives/toolbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent } from "@/types/models/agent";

import { GET_AGENTS } from "../queries";

export interface AgentGridProps {
  /** Navigation is the caller's job; the grid NEVER creates a session. */
  onSelect: (agent: Agent) => void;
  autoFocusSearch?: boolean;
}

export function AgentGrid({ onSelect, autoFocusSearch = false }: AgentGridProps) {
  const t = useTranslations();
  const [search, setSearch] = React.useState("");

  const { data, loading } = useQuery(GET_AGENTS, {
    variables: {
      page: 1,
      limit: 200,
      filters: [{ active: { eq: true } }],
    },
  });

  const agents: Agent[] = React.useMemo(
    () => data?.agentsPagination?.items || [],
    [data],
  );

  const filteredAgents = React.useMemo(() => {
    if (!search) return agents;
    const needle = search.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(needle) ||
        (agent.description || "").toLowerCase().includes(needle),
    );
  }, [agents, search]);

  return (
    <div className="space-y-4">
      {/* Agent search — the shared Toolbar primitive (chat.md §3); the
          filter is client-side over an already-loaded list, so no debounce. */}
      <Toolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("agentSelection.searchPlaceholder"),
          debounceMs: 0,
          autoFocus: autoFocusSearch,
        }}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent)}
              className="min-h-11 rounded-lg border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/50 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  <AgentVisual agent={agent} status="ready" className="size-12" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{agent.name}</p>
                  </div>
                  {agent.modelName && (
                    <Badge variant="secondary" className="max-w-full text-xs">
                      <span className="truncate">{agent.modelName}</span>
                    </Badge>
                  )}
                  {agent.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : search ? (
        <EmptyState
          icon={Search}
          title={t("agentSelection.noAgentsFound")}
          description={t("chat.agentSelect.noResultsDescription")}
          action={{
            label: t("chat.agentSelect.clearSearch"),
            onClick: () => setSearch(""),
          }}
        />
      ) : (
        <EmptyState
          title={t("agentSelection.noAgentsAvailable")}
          description={t("chat.agentSelect.noAgentsDescription")}
        />
      )}
    </div>
  );
}

/**
 * AgentGridNavigator — the /chat page's client wrapper: selecting an agent
 * navigates to /chat/[agent]/new WITHOUT creating a session (chat.md row 1).
 * Exists because /chat/page.tsx is a server component and cannot pass an
 * onSelect function across the RSC boundary.
 */
export function AgentGridNavigator({
  autoFocusSearch,
}: {
  autoFocusSearch?: boolean;
}) {
  const router = useRouter();
  return (
    <AgentGrid
      autoFocusSearch={autoFocusSearch}
      onSelect={(agent) => router.push(`/chat/${agent.id}/new`)}
    />
  );
}
