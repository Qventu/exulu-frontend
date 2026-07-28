"use client";

/**
 * RoutineRow / RoutineCard — presentational only. ZERO apollo imports.
 *
 * Receives a fully-resolved routine (agentName/lastRun/schedule populated by
 * the parent's batched hooks) plus row-action callbacks. The page hosts the
 * Run dialog + delete confirm + panel — row never opens an overlay directly.
 *
 * Workflows.md ladder items: 9 (name + description), 11 (status + relative
 * time), 12 (schedule chip), 14 (Run + overflow menu — with no-agent branch
 * keeping Delete + Edit reachable, fixing the trapped-capability bug).
 */

import { Edit, Eye, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { RelativeTime } from "@/components/primitives/relative-time";
import { StatusDot } from "@/components/primitives/status-dot";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Routine, RoutineAccess } from "../types";
import { CronChip } from "./cron-chip";
import { VisibilityChip } from "./visibility-chip";

export type RoutineRowState =
  | { status: "success" | "warning" | "error" | "info" | "muted"; label?: string }
  | null;

function mapState(state?: string | null): {
  status: "success" | "warning" | "error" | "info" | "muted";
  pulse: boolean;
} {
  switch (state) {
    case "completed":
      return { status: "success", pulse: false };
    case "failed":
    case "stuck":
      return { status: "error", pulse: false };
    case "active":
      return { status: "info", pulse: true };
    case "waiting":
    case "delayed":
    case "paused":
      return { status: "info", pulse: false };
    default:
      return { status: "muted", pulse: false };
  }
}

export interface RoutineRowProps {
  routine: Routine;
  /** Resolved by useLastRunForPage. */
  lastRun?: { state: string; createdAt: string } | null;
  /** Resolved by useSchedulesForPage. */
  schedule?: { schedule: string; next?: string | null } | null;
  access: RoutineAccess;
  /** Disabled when access.canRun=false or routine has no agent. */
  onRun: () => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onOpenPanel: () => void;
}

/** Desktop table-cell helpers — used by RoutineList's column defs. */
export function NameCell({ routine }: { routine: Routine }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-medium">{routine.name}</span>
        <VisibilityChip routine={routine} />
      </div>
      {routine.description ? (
        <span className="line-clamp-1 text-sm text-muted-foreground">
          {routine.description}
        </span>
      ) : null}
    </div>
  );
}

export function LastRunCell({
  lastRun,
}: {
  lastRun?: { state: string; createdAt: string } | null;
}) {
  const t = useTranslations("routines");
  if (!lastRun) {
    return (
      <div className="flex items-center gap-2">
        <StatusDot status="muted" label={t("lastRun.never")} />
      </div>
    );
  }
  const mapped = mapState(lastRun.state);
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={mapped.status} pulse={mapped.pulse} />
      <RelativeTime date={lastRun.createdAt} className="text-sm" />
    </div>
  );
}

export function ScheduleCell({
  schedule,
}: {
  schedule?: { schedule: string; next?: string | null } | null;
}) {
  return <CronChip schedule={schedule} />;
}

export function RunCell({
  routine,
  access,
  onRun,
}: {
  routine: Routine;
  access: RoutineAccess;
  onRun: () => void;
}) {
  const t = useTranslations("routines");
  const noAgent = !routine.agent;
  const disabled = !access.canRun || noAgent;

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={(event) => {
        event.stopPropagation();
        onRun();
      }}
      disabled={disabled}
      className="size-11 md:size-8 md:w-auto md:px-3"
    >
      <Play aria-hidden="true" className="size-3.5 md:mr-1" />
      <span className="hidden md:inline">{t("runActionLabel")}</span>
      <span className="sr-only md:hidden">{t("runActionLabel")}</span>
    </Button>
  );

  if (!disabled) return button;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{button}</span>
        </TooltipTrigger>
        <TooltipContent>
          {noAgent ? t("noAgent") : t("noWriteAccess")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RowOverflowMenu({
  access,
  onEdit,
  onView,
  onDelete,
}: {
  access: RoutineAccess;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("routines");
  const items = access.canWrite
    ? [
        { label: t("edit"), icon: Edit, onSelect: onEdit },
        {
          label: t("delete.action"),
          icon: Trash2,
          onSelect: onDelete,
          destructive: true as const,
        },
      ]
    : [{ label: t("view"), icon: Eye, onSelect: onView }];
  return <OverflowMenu items={items} label={t("rowActions")} />;
}

/** Mobile card variant — used by DataTable's mobileCard render prop. */
export function RoutineCard({
  routine,
  lastRun,
  schedule,
  access,
  onRun,
  onEdit,
  onView,
  onDelete,
  onOpenPanel,
}: RoutineRowProps) {
  return (
    <div
      className="flex w-full flex-col gap-2"
      onClick={onOpenPanel}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{routine.name}</span>
            <VisibilityChip routine={routine} />
          </div>
          {routine.description ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {routine.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RunCell routine={routine} access={access} onRun={onRun} />
          <span onClick={(e) => e.stopPropagation()}>
            <RowOverflowMenu
              access={access}
              onEdit={onEdit}
              onView={onView}
              onDelete={onDelete}
            />
          </span>
        </div>
      </div>
      <div className={cn("flex items-center gap-3 text-xs text-muted-foreground")}>
        <LastRunCell lastRun={lastRun} />
        {schedule?.schedule ? <CronChip schedule={schedule} /> : null}
      </div>
    </div>
  );
}
