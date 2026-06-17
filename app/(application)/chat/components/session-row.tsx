"use client";

/**
 * SessionRow — the history-rail / history-sheet row recipe (chat.md ladder
 * rows 13–15; "The Quiet Column", work item 2.3, owner "sessions").
 *
 * - Truncating title + ALWAYS-visible RelativeTime (`text-xs` muted) — fixes
 *   U6's hover-only timestamps.
 * - Active state by pathname (`bg-muted`).
 * - Write-gated OverflowMenu (`revealOnHover` — the primitive keeps the
 *   trigger visible on touch/focus, T7) with Rename (dialog, Enter submits —
 *   item 14, rail entry; the ChatHeader inline edit is the second entry, both
 *   via useSessionMutations) and Delete behind the shared ConfirmDialog
 *   (item 15 — fixes U3's no-confirmation delete).
 * - ≥44 px touch target below `md` (responsive.md touch rules).
 *
 * Replaces the row markup inside the legacy
 * app/(application)/chat/[agent]/chat-sessions.tsx.
 */

import { PenLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkChatSessionWriteAccess } from "@/lib/check-chat-session-write-access";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/models/agent";
import type { AgentSession } from "@/types/models/agent-session";

import type { UseSessionMutationsResult } from "../hooks";

/**
 * The session list query populates `.agent` as an object (contract:
 * UseChatSessionsResult — "cast at use site").
 */
export type SessionListItem = Omit<AgentSession, "agent"> & {
  agent: Agent | string;
};

export interface SessionRowProps {
  session: SessionListItem;
  agentId: string;
  /** Single useSessionMutations instance owned by the rail (no per-row hooks). */
  mutations: UseSessionMutationsResult;
  /** Called on navigation so the mobile history Sheet can close itself. */
  onNavigate?: () => void;
}

export function SessionRow({
  session,
  agentId,
  mutations,
  onNavigate,
}: SessionRowProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const { user } = React.useContext(UserContext);

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const active = Boolean(pathname?.includes(session.id));
  const displayTitle = session.title || t("history.untitled");

  const sessionAgentId =
    typeof session.agent === "string" ? session.agent : session.agent?.id;
  const writeAccess = user
    ? checkChatSessionWriteAccess(
        { ...session, agent: sessionAgentId } as AgentSession,
        user,
      )
    : false;

  const submitRename = async () => {
    const title = renameValue.trim();
    if (!title || mutations.renaming) return;
    const ok = await mutations.renameSession(session.id, title);
    if (!ok) {
      toast.error(t("history.renameFailed"));
      return;
    }
    toast.success(t("history.renamed"));
    setRenameOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center rounded-md transition-colors duration-150 motion-reduce:transition-none",
          active ? "bg-muted" : "hover:bg-accent",
        )}
      >
        <Link
          href={`/chat/${agentId}/${session.id}`}
          aria-current={active ? "page" : undefined}
          onClick={() => onNavigate?.()}
          className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-md px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="truncate text-sm font-medium">{displayTitle}</span>
          {session.updatedAt ? (
            // Always visible (fixes U6) — text-xs muted per ladder row 13.
            <RelativeTime
              date={session.updatedAt}
              className="self-start text-xs text-muted-foreground"
            />
          ) : null}
        </Link>

        {writeAccess ? (
          <OverflowMenu
            revealOnHover
            label={t("history.rowMenuLabel")}
            className="mr-1 shrink-0 max-md:size-11"
            items={[
              {
                label: t("history.rename"),
                icon: PenLine,
                onSelect: () => {
                  setRenameValue(session.title || "");
                  setRenameOpen(true);
                },
              },
              {
                label: tCommon("delete"),
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleteOpen(true),
              },
            ]}
          />
        ) : null}
      </div>

      {/* Rename (item 14, rail entry) — Enter submits. */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("history.renameTitle")}</DialogTitle>
            <DialogDescription>
              {t("history.renameDescription")}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitRename();
              }
            }}
            placeholder={t("history.namedChatPlaceholder")}
            aria-label={t("history.namedChatPlaceholder")}
            className="text-base md:text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenameOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void submitRename()}
              disabled={mutations.renaming || !renameValue.trim()}
            >
              {t("history.rename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete (item 15) — the shared ConfirmDialog, never a bare mutation (U3). */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("history.deleteTitle")}
        description={t("history.deleteDescription", { title: displayTitle })}
        confirmLabel={tCommon("delete")}
        onConfirm={async () => {
          const ok = await mutations.deleteSession(session.id);
          if (!ok) {
            toast.error(t("history.deleteFailed"));
            // Reject → the dialog stays open for retry/cancel.
            throw new Error("Failed to delete session");
          }
          toast.success(t("history.deleted"));
          // Deleting the conversation you are reading must not strand you on
          // a dead route — fall back to a fresh chat.
          if (active) {
            router.push(`/chat/${agentId}/new`);
          }
        }}
      />
    </>
  );
}
