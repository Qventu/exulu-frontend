"use client";

/**
 * Sessions tab — THE L1 surface of the project detail page (projects.md §3:
 * "a project is a place you work"; inventory 29-34).
 *
 * Design-doc fixes baked in:
 * - Row anatomy: stretched-link title into /chat/[agent]/[session] (chat's
 *   existing route — no parallel navigation), agent name resolved via the
 *   client-side GET_PROJECT_AGENTS join (SessionRow data note; renders
 *   nothing while unresolved/deleted, never the raw id), RelativeTime,
 *   OverflowMenu (T7: always reachable, never hover-only).
 * - "Remove from project" is immediate with an undo toast (ladder row 31).
 * - "Delete session…" goes through the shared ConfirmDialog (fixes UX 1 —
 *   the unconfirmed permanent destruction).
 * - Both actions await their mutation BEFORE refetching (fixes the UX 9
 *   stale-list race) and are RBAC-gated via checkChatSessionWriteAccess with
 *   an explanatory line on the disabled items (ladder row 33).
 * - Confirmed deletes collapse the row (300 ms height+fade, reduced-motion
 *   safe) before the list reflows (projects.md motion 4).
 * - Pagination: "Load more" past 50 (fixes UX 11).
 */

import { useMutation } from "@apollo/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquare, PackageMinus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import type { AgentSession } from "@/types/models/agent-session";

import {
  REMOVE_AGENT_SESSION_BY_ID,
  UPDATE_AGENT_SESSION_PROJECT,
} from "../queries";
import { SessionRowSkeleton } from "./skeletons";

export function SessionsTab({
  projectId,
  sessions,
  loading,
  canLoadMore,
  loadMore,
  refetch,
  agentName,
  onNewSession,
}: {
  projectId: string;
  sessions: AgentSession[] | undefined;
  loading: boolean;
  canLoadMore: boolean;
  loadMore: () => void;
  refetch: () => Promise<unknown>;
  agentName: (id: string | undefined) => string | undefined;
  onNewSession: () => void;
}) {
  const t = useTranslations("projects");
  const { user } = React.useContext(UserContext);
  const reducedMotion = useReducedMotion();

  const [updateSessionProject] = useMutation(UPDATE_AGENT_SESSION_PROJECT);
  const [removeSession] = useMutation(REMOVE_AGENT_SESSION_BY_ID);
  const [pendingDelete, setPendingDelete] = React.useState<AgentSession | null>(
    null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Remove from project = non-destructive detach, immediate with undo
  // (ladder row 31). The undo re-attaches the same session.
  const handleRemoveFromProject = async (session: AgentSession) => {
    if (busyId) return;
    setBusyId(session.id);
    try {
      await updateSessionProject({
        variables: { id: session.id, project: null },
      });
      await refetch();
      toast.success(t("sessions.removed"), {
        action: {
          label: t("sessions.undo"),
          onClick: () => {
            void (async () => {
              try {
                await updateSessionProject({
                  variables: { id: session.id, project: projectId },
                });
                await refetch();
              } catch (error) {
                console.error("Error restoring session:", error);
                toast.error(t("sessions.restoreError"));
              }
            })();
          },
        },
      });
    } catch (error) {
      console.error("Error removing session from project:", error);
      toast.error(t("sessions.removeError"));
    } finally {
      setBusyId(null);
    }
  };

  const rows = sessions ?? [];
  const initialLoading = loading && rows.length === 0;

  return (
    <div className="space-y-4">
      {initialLoading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <SessionRowSkeleton key={index} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("sessions.emptyTitle")}
          description={t("sessions.emptyDescription")}
          action={{ label: t("detail.newSession"), onClick: onNewSession }}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rows.map((session, index) => {
              const writeAccess = checkChatSessionWriteAccess(session, user);
              const agent = agentName(session.agent);
              return (
                <motion.li
                  key={session.id}
                  layout={!reducedMotion}
                  initial={false}
                  exit={
                    reducedMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : {
                          opacity: 0,
                          height: 0,
                          marginBottom: 0,
                          transition: { duration: 0.3, ease: "easeInOut" },
                        }
                  }
                  className="overflow-hidden"
                >
                  <div
                    className="group relative flex min-h-[44px] items-center gap-3 rounded-md border border-border p-3 transition-colors duration-150 hover:bg-muted/50 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                    style={{
                      animationDelay: `${Math.min(index, 8) * 20}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <MessageSquare
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      {/* Stretched link = full-row tap target (≥44px). */}
                      <Link
                        href={`/chat/${session.agent}/${session.id}`}
                        className="text-sm font-medium after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
                      >
                        <span className="block truncate">
                          {session.title || t("sessions.untitled")}
                        </span>
                      </Link>
                      <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {agent && <span className="truncate">{agent}</span>}
                        {agent && session.updatedAt && (
                          <span aria-hidden="true">·</span>
                        )}
                        {session.updatedAt && (
                          <span className="shrink-0">
                            {t("updatedLabel")}{" "}
                            <RelativeTime date={session.updatedAt} />
                          </span>
                        )}
                      </p>
                    </div>
                    <OverflowMenu
                      label={t("sessions.actions")}
                      // ≥44px touch target below md (responsive.md DoD).
                      className="relative z-10 size-11 shrink-0 md:size-8"
                      items={[
                        {
                          label: t("sessions.removeFromProject"),
                          icon: PackageMinus,
                          disabled: !writeAccess || busyId === session.id,
                          description: !writeAccess
                            ? t("sessions.noWriteAccess")
                            : undefined,
                          onSelect: () => void handleRemoveFromProject(session),
                        },
                        {
                          label: t("sessions.deleteSession"),
                          icon: Trash2,
                          destructive: true,
                          disabled: !writeAccess || busyId === session.id,
                          description: !writeAccess
                            ? t("sessions.noWriteAccess")
                            : undefined,
                          onSelect: () => setPendingDelete(session),
                        },
                      ]}
                    />
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {canLoadMore && rows.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={loading}
          onClick={loadMore}
        >
          {t("loadMore")}
        </Button>
      )}

      {/* Permanent destruction at L3 behind the shared confirm (fixes UX 1). */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("sessions.deleteTitle")}
        description={
          pendingDelete
            ? t("sessions.deleteDescription", {
                title: pendingDelete.title || t("sessions.untitled"),
              })
            : undefined
        }
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await removeSession({ variables: { id: pendingDelete.id } });
            await refetch();
            setPendingDelete(null);
          } catch (error) {
            console.error("Error deleting session:", error);
            toast.error(t("sessions.deleteError"));
            throw error;
          }
        }}
      />
    </div>
  );
}
