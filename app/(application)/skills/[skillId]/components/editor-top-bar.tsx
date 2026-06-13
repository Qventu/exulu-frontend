"use client";

/**
 * EditorTopBar — the slim h-12 top bar of the skill editor.
 *
 * Spec: design/pages/skills.md inventory #42, #43, #44, #45, #46, #47, #67
 * + additive Copy skill ID; ladder rows 42–47; responsive.md T3 (header
 * stacks/collapses), T7 (touch path).
 *
 * Desktop layout: [sidebar toggle] · [back] · [Sparkles + name + vN] ·
 *                 [Refresh icon] [History outline] [Save Version] [⋯]
 *
 * Below md the sidebar toggle becomes the trigger for the file-tree
 * Sheet (rendered by FileSidebar). Refresh + History collapse into the
 * OverflowMenu; Save Version stays inline (the editor's one purple
 * element) but goes icon-only on the smallest widths to fit alongside
 * the back link and the truncating name.
 *
 * canWrite=false (skills.md #67): Save Version is hidden — the editor
 * itself renders read-only and there is nothing to snapshot.
 */

import {
  ArrowLeft,
  Copy,
  GitBranch,
  History,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { OverflowMenu, type OverflowMenuItem } from "@/components/primitives/overflow-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { Skill } from "../../types";

export interface EditorTopBarProps {
  skill: Skill;
  canWrite: boolean;
  sidebarOpen: boolean;
  filesLoading: boolean;
  savingVersion: boolean;
  onToggleSidebar: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onOpenHistory: () => void;
  onRequestSaveVersion: () => void;
}

export function EditorTopBar({
  skill,
  canWrite,
  sidebarOpen,
  filesLoading,
  savingVersion,
  onToggleSidebar,
  onBack,
  onRefresh,
  onOpenHistory,
  onRequestSaveVersion,
}: EditorTopBarProps) {
  const t = useTranslations("skills");
  const router = useRouter();
  const isMobile = useIsMobile();

  const handleCopyId = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(skill.id);
      toast.success(t("editor.toasts.idCopied"));
    } catch {
      toast.error(t("editor.toasts.copyFailed"));
    }
  }, [skill.id, t]);

  const handleBack = () => {
    // onBack lets the host run the unsaved-leave guard before routing.
    onBack();
    router.push("/skills");
  };

  // OverflowMenu items — desktop just gets Copy ID; mobile absorbs
  // Refresh + History (which collapse out of the inline cluster <md).
  const overflowItems: OverflowMenuItem[] = React.useMemo(() => {
    const items: OverflowMenuItem[] = [];
    if (isMobile) {
      items.push({
        label: t("editor.topbar.refresh"),
        icon: RefreshCw,
        onSelect: onRefresh,
        disabled: filesLoading,
      });
      items.push({
        label: t("editor.topbar.history"),
        icon: History,
        onSelect: onOpenHistory,
      });
    }
    items.push({
      label: t("editor.topbar.copyId"),
      icon: Copy,
      onSelect: () => void handleCopyId(),
    });
    return items;
  }, [
    filesLoading,
    handleCopyId,
    isMobile,
    onOpenHistory,
    onRefresh,
    t,
  ]);

  const currentVersion = skill.current_version ?? 1;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-12 flex-shrink-0 items-center gap-1 border-b bg-background px-2 sm:gap-2 sm:px-3">
        {/* Sidebar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 flex-shrink-0"
              onClick={onToggleSidebar}
              aria-label={
                sidebarOpen
                  ? t("editor.topbar.collapseFiles")
                  : t("editor.topbar.expandFiles")
              }
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {sidebarOpen
              ? t("editor.topbar.collapseFiles")
              : t("editor.topbar.expandFiles")}
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        {/* Back */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 flex-shrink-0"
              onClick={handleBack}
              aria-label={t("editor.topbar.backToSkills")}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("editor.topbar.backToSkills")}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5" />

        {/* Identity: Sparkles + name + vN, truncating from the right.
            The name itself can be a long word, so we let it shrink with
            min-w-0 inside the flex-1 wrapper. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h1
            className="min-w-0 truncate text-sm font-semibold"
            title={skill.name}
          >
            {skill.name}
          </h1>
          <Badge
            variant="secondary"
            className="shrink-0 font-mono text-xs"
            aria-label={t("editor.topbar.versionLabel", {
              version: currentVersion,
            })}
          >
            v{currentVersion}
          </Badge>
        </div>

        {/* Action cluster */}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {/* Refresh — desktop inline, mobile in overflow. */}
          {!isMobile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onRefresh}
                  disabled={filesLoading}
                  aria-label={t("editor.topbar.refresh")}
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      filesLoading && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("editor.topbar.refresh")}</TooltipContent>
            </Tooltip>
          ) : null}

          {/* History — desktop inline, mobile in overflow. */}
          {!isMobile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenHistory}
              className="gap-1.5"
            >
              <History className="size-3.5" aria-hidden="true" />
              {t("editor.topbar.history")}
            </Button>
          ) : null}

          {/* Save Version — the editor's one purple element (#47). Hidden
              under read-only. Icon-only on tiny widths so it fits alongside
              the truncating name on a 320px phone. */}
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              onClick={onRequestSaveVersion}
              disabled={savingVersion}
              aria-busy={savingVersion}
              className="gap-1.5"
              aria-label={t("editor.topbar.saveVersion")}
            >
              {savingVersion ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <GitBranch className="size-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {t("editor.topbar.saveVersion")}
              </span>
            </Button>
          ) : null}

          <OverflowMenu
            items={overflowItems}
            label={t("editor.topbar.moreActions")}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
