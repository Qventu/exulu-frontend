"use client";

/**
 * New-session agent picker (inventory 30; ladder row 30 — L1 trigger in the
 * PageHeader, L3 dialog). Route-local successor of
 * components/agent-selection-dialog.tsx's AgentSelectionModalContent (chat
 * replaced its own usage with AgentGrid; this work item retires the global
 * file, see agent-grid.tsx header note).
 *
 * The DialogDescription PRESERVES the trust disclosure "Sessions started in
 * a project can be viewed by project members." (project-details.tsx:676,
 * localized) — complementing the L1 visibility badge in the header
 * (philosophy §8/§9).
 *
 * Mutation contract unchanged: CREATE_AGENT_SESSION with `project: <id>` and
 * `rights_mode: "private"`, then navigate into chat (chat's existing
 * /chat/[agent]/[session] route — no parallel navigation pattern).
 */

import { useMutation } from "@apollo/client";
import { Bot, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import AgentVisual from "@/components/lottie";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent } from "@/types/models/agent";

import type { ProjectAgent } from "../hooks";
import { CREATE_AGENT_SESSION } from "../queries";

export function NewSessionDialog({
  open,
  onOpenChange,
  projectId,
  agents,
  agentsLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  agents: ProjectAgent[];
  agentsLoading: boolean;
}) {
  const t = useTranslations("projects");
  const tAgents = useTranslations("agentSelection");
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [creatingId, setCreatingId] = React.useState<string | null>(null);

  const [createAgentSession] = useMutation(CREATE_AGENT_SESSION);

  const filteredAgents = React.useMemo(() => {
    if (!search.trim()) return agents;
    const needle = search.trim().toLowerCase();
    return agents.filter((agent) =>
      agent.name.toLowerCase().includes(needle),
    );
  }, [agents, search]);

  const handleSelect = async (agent: ProjectAgent) => {
    if (creatingId) return;
    setCreatingId(agent.id);
    try {
      const result = await createAgentSession({
        variables: {
          title: tAgents("newSession", { agentName: agent.name }),
          agent: agent.id,
          project: projectId,
          rights_mode: "private",
        },
      });
      const sessionId = result.data?.agent_sessionsCreateOne?.item?.id;
      if (sessionId) {
        setSearch("");
        onOpenChange(false);
        router.push(`/chat/${agent.id}/${sessionId}`);
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : tAgents("sessionError"),
      );
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (creatingId) return;
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("newSessionDialog.title")}</DialogTitle>
          {/* Trust disclosure — must survive the redesign (inventory 30). */}
          <DialogDescription>
            {t("newSessionDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tAgents("searchPlaceholder")}
            aria-label={tAgents("searchPlaceholder")}
            className="pl-9 text-base md:text-sm"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {agentsLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-border p-4"
                >
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleSelect(agent)}
                  disabled={creatingId !== null}
                  aria-busy={creatingId === agent.id}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors duration-150 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
                    {creatingId === agent.id ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-5 animate-spin text-muted-foreground"
                      />
                    ) : (
                      <AgentVisual
                        // AgentVisual only reads the animation fields; the
                        // narrowed selection (queries.ts) covers them.
                        agent={agent as unknown as Agent}
                        status="ready"
                        className="size-12"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    {agent.modelName && (
                      <Badge variant="secondary" className="text-xs">
                        {agent.modelName}
                      </Badge>
                    )}
                    {agent.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="quiet"
              icon={Bot}
              title={
                search
                  ? tAgents("noAgentsFound")
                  : tAgents("noAgentsAvailable")
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
