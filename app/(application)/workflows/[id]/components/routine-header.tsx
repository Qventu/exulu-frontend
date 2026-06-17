"use client";

/**
 * RoutineHeader — the routine workbench header.
 *
 * After the editor-dialog removal, the overflow menu shrinks to a single
 * "Copy ID" item:
 * - Edit / View moved inline (Basics / Access / Steps sections).
 * - Delete moved to the Danger Zone section (still uses DeleteRoutineDialog).
 * - Run stays as the primary action next to the menu.
 *
 * Breadcrumb is a <Link>, so useUnsavedChangesGuard's capture-phase click
 * handler intercepts Back-via-breadcrumb natively. The agent meta link is
 * also a <Link>, same guarantee.
 */

import { Copy, Play, Workflow } from "lucide-react";
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
  /** Last-saved title — falls back to `routine.name` (SSR). Defined so the
   *  header reflects a freshly-saved name without waiting for an SSR refresh
   *  (the page only refetches the routine LIST, not the by-id query). */
  displayName?: string;
  onRun: () => void;
}

export function RoutineHeader({
  routine,
  access,
  agentName,
  displayName,
  onRun,
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
    {
      label: t("workbench.copyId"),
      icon: Copy,
      onSelect: () => void copyId(),
    },
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
      title={displayName ?? routine.name}
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
