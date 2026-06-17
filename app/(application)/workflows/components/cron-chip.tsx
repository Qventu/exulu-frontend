"use client";

/**
 * CronChip — quiet font-mono cron string with a "Next run …" tooltip when a
 * schedule exists; em-dash when nothing is set (workflows.md ladder #12).
 *
 * Receives already-resolved schedule data (from useSchedulesForPage or the
 * embedded routine.schedule field) — never fetches.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { RelativeTime } from "@/components/primitives/relative-time";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CronChipProps {
  schedule?: { schedule: string; next?: string | null } | null;
}

export function CronChip({ schedule }: CronChipProps) {
  const t = useTranslations("routines");

  if (!schedule?.schedule) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const chip = (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {schedule.schedule}
    </code>
  );

  if (!schedule.next) return chip;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            {chip}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-xs">
            {t("schedule.nextRun")}{" "}
            <RelativeTime date={schedule.next} />
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
