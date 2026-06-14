"use client";

/**
 * RoutineHeader — the routine workbench header.
 *
 * Mirrors the agents EditorHeader shape but routines-shaped:
 * - Breadcrumb "Routines / {name}" via PageHeader.
 * - Leading slot = small Workflow icon tile (routines have no avatar; the
 *   tile prevents the title from sitting flush against the breadcrumb).
 * - Meta row = agent link ("Uses {agentName}" → /agents/edit/{routine.agent}
 *   or t("noAgent")) + VisibilityChip.
 * - Action cluster (right): primary Run (Play icon, disabled when noAgent ||
 *   !access.canRun, with Tooltip explaining why), OverflowMenu with Edit
 *   (canWrite) / View (read-only) / Copy ID / Delete destructive.
 * - <sm absorbs everything except Run into OverflowMenu (matches PageHeader's
 *   responsive contract).
 */

import {
  Copy,
  Edit,
  Eye,
  Play,
  Trash2,
  Workflow,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { PageHeader } from "@/components/primitives/page-header";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { VisibilityChip } from "../../components/visibility-chip";
import type { Routine, RoutineAccess } from "../../types";

export interface RoutineHeaderProps {
  routine: Routine;
  access: RoutineAccess;
  agentName?: string | null;
  onRun: () => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}

export function RoutineHeader({
  routine,
  access,
  agentName,
  onRun,
  onEdit,
  onView,
  onDelete,
}: RoutineHeaderProps) {
  const t = useTranslations("routines");
  const tCommon = useTranslations("common");

  const noAgent = !routine.agent;
  const runDisabled = !access.canRun || noAgent;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(routine.id);
      toast.success(tCommon("copied"));
    } catch {
      toast.error(tCommon("copyFailed"));
    }
  };

  const overflowItems = [
    ...(access.canWrite
      ? [{ label: t("edit"), icon: Edit, onSelect: onEdit }]
      : [{ label: t("view"), icon: Eye, onSelect: onView }]),
    { label: t("workbench.copyId"), icon: Copy, onSelect: () => void copyId() },
    ...(access.canWrite
      ? [
          {
            label: t("delete.action"),
            icon: Trash2,
            destructive: true as const,
            onSelect: onDelete,
          },
        ]
      : []),
  ];

  const runButton = (
    <Button onClick={onRun} disabled={runDisabled}>
      <Play aria-hidden="true" className="mr-2 size-4" />
      {t("runActionLabel")}
    </Button>
  );

  const action = (
    <div className="flex flex-wrap items-center gap-2">
      {runDisabled ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* `span` wrapper so the disabled button still receives hover/
                  focus for the tooltip — same pattern as the legacy panel. */}
              <span tabIndex={0}>{runButton}</span>
            </TooltipTrigger>
            <TooltipContent>
              {noAgent ? t("noAgent") : t("noWriteAccess")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        runButton
      )}
      <OverflowMenu label={t("panelActions")} items={overflowItems} />
    </div>
  );

  const meta = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {routine.agent ? (
        <span>
          {t("workbench.usesAgent")}{" "}
          <Link
            href={`/agents/edit/${routine.agent}`}
            className="text-foreground hover:underline"
          >
            {agentName ?? routine.agent}
          </Link>
        </span>
      ) : (
        <span>{t("noAgent")}</span>
      )}
      <VisibilityChip routine={routine} />
    </div>
  );

  return (
    <PageHeader
      breadcrumb={{ label: t("title"), href: "/workflows" }}
      title={routine.name}
      action={action}
      meta={meta}
      leading={
        <div
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"
        >
          <Workflow className="size-5" />
        </div>
      }
    />
  );
}
