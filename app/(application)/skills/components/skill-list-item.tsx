"use client";

/**
 * SkillListItem — slim list row for /skills (work item 2.10; skills.md §3
 * "List rows" + inventory items 12-19). Replaces the legacy hover-only row.
 *
 * Anatomy (skills.md §3):
 *   line 1: name (truncated) + secondary mono badge `vN` + OverflowMenu kebab
 *           (visible always — touch path, fixes H2/H3).
 *   line 2: <AccessBadge variant="row" /> · "N versions" · RelativeTime.
 *           Tags are NOT on the row (moved to detail panel per item #17).
 *
 * NO nested interactives (fixes H2 — legacy row was a <button> containing
 * inner <Button>s, invalid HTML + broken keyboard semantics). The row IS the
 * single click target; the kebab is the only nested interactive.
 *
 * OverflowMenu items (skills.md item #19/#20 + additive Copy ID):
 *   - Open editor → /skills/[id]
 *   - Copy skill ID (additive — P4 use)
 *   - Delete… (only when canWrite, opens parent's ConfirmDialog)
 */

import { ExternalLink, GitBranch, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Skill } from "../types";
import { AccessBadge } from "./access-badge";

export interface SkillListItemProps {
  skill: Skill;
  isSelected: boolean;
  canWrite: boolean;
  onSelect: () => void;
  /** Navigate to /skills/[id]. */
  onOpenEditor: () => void;
  /** Bubble to the library page, which hosts the single ConfirmDialog. */
  onRequestDelete: () => void;
  onCopyId: () => void;
}

export function SkillListItem({
  skill,
  isSelected,
  canWrite,
  onSelect,
  onOpenEditor,
  onRequestDelete,
  onCopyId,
}: SkillListItemProps) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");

  const versionCount = (skill.history?.length ?? 0) + 1;

  const overflowItems = React.useMemo<OverflowMenuItem[]>(() => {
    const items: OverflowMenuItem[] = [
      {
        label: t("row.openEditor"),
        icon: ExternalLink,
        onSelect: onOpenEditor,
      },
      {
        label: t("row.copyId"),
        onSelect: onCopyId,
      },
    ];
    if (canWrite) {
      items.push({
        label: tCommon("delete"),
        icon: Trash2,
        destructive: true,
        onSelect: onRequestDelete,
      });
    }
    return items;
  }, [canWrite, onCopyId, onOpenEditor, onRequestDelete, t, tCommon]);

  return (
    <li>
      <div
        className={cn(
          "group flex min-h-11 w-full items-start gap-2 border-l-2 px-3 py-2.5 transition-colors duration-150",
          isSelected
            ? "border-l-primary bg-muted/50"
            : "border-l-transparent hover:bg-muted/50",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onOpenEditor}
          aria-current={isSelected || undefined}
          className={cn(
            "min-w-0 flex-1 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {skill.name}
              </span>
              <Badge
                variant="secondary"
                className="shrink-0 font-mono text-xs"
              >
                v{skill.current_version ?? 1}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AccessBadge mode={skill.rights_mode} variant="row" />
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <GitBranch aria-hidden="true" className="size-3" />
                {t("row.versionsCount", { count: versionCount })}
              </span>
              <span aria-hidden="true">·</span>
              <RelativeTime date={skill.updatedAt} className="truncate" />
            </div>
          </div>
        </button>
        <OverflowMenu
          items={overflowItems}
          label={t("row.actionsLabel", { name: skill.name })}
          className="size-11 md:size-8"
        />
      </div>
    </li>
  );
}
