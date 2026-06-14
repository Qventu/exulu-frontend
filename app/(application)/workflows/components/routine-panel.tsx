"use client";

/**
 * RoutinePanel — the detail panel that replaces the four stacked dialogs
 * (Run, Schedule, Share, Queue) in the legacy routines page.
 *
 * Header: name + agent link + VisibilityChip + Run + OverflowMenu (Edit/View,
 * Delete). Body: Tabs (Overview, Runs, Schedule, Queue). Mobile parity comes
 * from ListDetail's Sheet — the panel itself just stacks its tabs vertically
 * when narrow.
 */

import { Edit, Eye, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";

import { OverflowMenu } from "@/components/primitives/overflow-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Routine, RoutineAccess, RoutinePanelTab } from "../types";
import { OverviewSection } from "./overview-section";
import { QueueSection } from "./queue-section";
import { RunsSection } from "./runs-section";
import { ScheduleSection } from "./schedule-section";
import { VisibilityChip } from "./visibility-chip";

export interface RoutinePanelProps {
  routine: Routine;
  access: RoutineAccess;
  /** Display name for the linked agent (resolved at page level). */
  agentName?: string | null;
  /** Queue name for the agent (resolved at page level); null when not set. */
  queueName?: string | null;
  defaultTab?: RoutinePanelTab;
  onRun: () => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onManageQueue: (queueName: string) => void;
}

export function RoutinePanel({
  routine,
  access,
  agentName,
  queueName,
  defaultTab = "overview",
  onRun,
  onEdit,
  onView,
  onDelete,
  onManageQueue,
}: RoutinePanelProps) {
  const t = useTranslations("routines");
  const [tab, setTab] = React.useState<RoutinePanelTab>(defaultTab);

  const noAgent = !routine.agent;
  const runDisabled = !access.canRun || noAgent;

  const runButton = (
    <Button onClick={onRun} disabled={runDisabled} size="sm">
      <Play aria-hidden="true" className="mr-2 size-4" />
      {t("run")}
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="border-b p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-semibold leading-tight">{routine.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {routine.agent ? (
                <Link
                  href={`/agents/edit/${routine.agent}`}
                  className="hover:text-foreground hover:underline"
                >
                  {agentName ?? routine.agent}
                </Link>
              ) : (
                <span>{t("noAgent")}</span>
              )}
              <VisibilityChip routine={routine} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {runDisabled ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
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
            <OverflowMenu
              label={t("panelActions")}
              items={
                access.canWrite
                  ? [
                      { label: t("edit"), icon: Edit, onSelect: onEdit },
                      {
                        label: t("delete.action"),
                        icon: Trash2,
                        onSelect: onDelete,
                        destructive: true as const,
                      },
                    ]
                  : [{ label: t("view"), icon: Eye, onSelect: onView }]
              }
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as RoutinePanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-4">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="runs">{t("tabs.runs")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("tabs.schedule")}</TabsTrigger>
          <TabsTrigger value="queue">{t("tabs.queue")}</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="overview" className="m-0">
            <OverviewSection routine={routine} />
          </TabsContent>
          <TabsContent value="runs" className="m-0">
            <RunsSection routine={routine} />
          </TabsContent>
          <TabsContent value="schedule" className="m-0">
            <ScheduleSection routine={routine} access={access} />
          </TabsContent>
          <TabsContent value="queue" className="m-0">
            <QueueSection queueName={queueName} onManageQueue={onManageQueue} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
