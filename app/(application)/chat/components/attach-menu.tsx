"use client";

/**
 * AttachMenu — the composer's ＋ menu ("The Quiet Column", chat.md items 64/65/66/69/70/72).
 *
 * One Popover replaces the legacy Files / Prompts / Context / Skills / Tools
 * button row (chat.tsx:1171–1274). Entries:
 *   - Add knowledge   → opens ItemsSelectionModal (item 66; managed-context note, item 72)
 *   - Insert prompt   → opens PromptSelectorModal (item 65)
 *   - Session files   → controller.setFilesPanelOpen(true) (item 64)
 *   - Skills & tools  → opens CapabilitySheet (items 69/70 entry)
 *
 * A quiet "N off" badge bubbles onto the ＋ trigger so a non-default
 * capability state stays visible at L1 (chat.md ladder rows 69–70).
 *
 * NOTE (recorded deviation): no direct-OS-file-upload entry exists — none
 * exists today either; uploads live in the session-files panel.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  FileText,
  FolderOpen,
  Plus,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ChatSessionController } from "../hooks";

export interface AttachMenuProps {
  controller: ChatSessionController;
  onOpenPrompts: () => void;
  onOpenContext: () => void;
  onOpenCapabilities: () => void;
}

function MenuEntry({
  icon: Icon,
  label,
  description,
  trailing,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  trailing?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-150",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        // Touch targets ≥44px below md (responsive.md §2).
        "min-h-[44px] md:min-h-0 md:py-2",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}

export function AttachMenu({
  controller,
  onOpenPrompts,
  onOpenContext,
  onOpenCapabilities,
}: AttachMenuProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = React.useState(false);

  const { agent } = controller;
  const hasCapabilities =
    (agent.skills?.length ?? 0) > 0 || (agent.tools?.length ?? 0) > 0;

  // "N off" counts only ids that belong to this agent's capabilities so a
  // stale disabled id can never inflate the badge.
  const capabilityIds = React.useMemo(
    () => [...(agent.skills ?? []), ...(agent.tools ?? [])].map((item) => item.id),
    [agent.skills, agent.tools],
  );
  const disabledCount = capabilityIds.filter((id) =>
    controller.disabledTools.includes(id),
  ).length;

  const select = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-11 shrink-0 md:size-9"
          aria-label={t("attach.open")}
        >
          <Plus className="size-5" aria-hidden="true" />
          {disabledCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute -right-1 -top-1 h-4 whitespace-nowrap px-1.5 text-[10px] leading-none"
            >
              {t("attach.disabledCount", { count: disabledCount })}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-1">
        <MenuEntry
          icon={Brain}
          label={t("attach.addKnowledge")}
          description={
            controller.managedContextEnabled
              ? t("attach.addKnowledgeManagedNote")
              : t("attach.addKnowledgeDescription")
          }
          onSelect={() => select(onOpenContext)}
        />
        <MenuEntry
          icon={FileText}
          label={t("attach.insertPrompt")}
          description={t("attach.insertPromptDescription")}
          onSelect={() => select(onOpenPrompts)}
        />
        <MenuEntry
          icon={FolderOpen}
          label={t("attach.sessionFiles")}
          description={t("attach.sessionFilesDescription")}
          onSelect={() => select(() => void controller.setFilesPanelOpen(true))}
        />
        {hasCapabilities && (
          <MenuEntry
            icon={Wrench}
            label={t("attach.skillsAndTools")}
            description={t("attach.skillsAndToolsDescription")}
            trailing={
              disabledCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="mt-0.5 h-4 shrink-0 whitespace-nowrap px-1.5 text-[10px] leading-none"
                >
                  {t("attach.disabledCount", { count: disabledCount })}
                </Badge>
              ) : undefined
            }
            onSelect={() => select(onOpenCapabilities)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
