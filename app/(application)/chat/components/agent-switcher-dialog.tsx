"use client";

/**
 * AgentSwitcherDialog — chat.md ladder row 9 ("Back to agent selection" → L2).
 *
 * The history rail's agent-name button opens this dialog, which hosts
 * orchestration's AgentGrid (the same selection grid as /chat). Selecting an
 * agent navigates to `/chat/[agent]/new` — navigation only, NEVER a session
 * create (lazy creation, chat.md row 1/34). Replaces the dead
 * "Back to agent selection" row in the legacy chat-sessions.tsx.
 *
 * Binding contract (work item 2.3): AgentSwitcherDialogProps
 * { open; onOpenChange } — owner "sessions"; AgentGrid is owner
 * "orchestration" (cross-owner contract §4).
 */

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Agent } from "@/types/models/agent";

import { AgentGrid } from "./agent-grid";

export interface AgentSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentSwitcherDialog({
  open,
  onOpenChange,
}: AgentSwitcherDialogProps) {
  const t = useTranslations("chat");
  const router = useRouter();

  const handleSelect = (agent: Agent) => {
    onOpenChange(false);
    router.push(`/chat/${agent.id}/new`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("history.switchAgentTitle")}</DialogTitle>
          <DialogDescription>
            {t("history.switchAgentDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AgentGrid autoFocusSearch onSelect={handleSelect} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
