"use client";

/**
 * The monthly meeting-recording usage card (against the optional cap) —
 * extracted from the Transcripts home (page.tsx) so the settings page's right
 * column (settings design doc §5, final fix wave Fix 4a) can show the exact
 * same card instead of rebuilding it. `useRecordingUsage` (hooks.ts) is the
 * only data source; this component is pure presentation.
 */
import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";

import type { RecordingUsage } from "../hooks";
import { formatDuration } from "../types";

export interface RecordingUsageCardProps {
  usage: RecordingUsage | null;
}

export function RecordingUsageCard({ usage }: RecordingUsageCardProps) {
  const t = useTranslations("transcriptions");

  // `enabled` alone is not the right test: a workspace with recording on and
  // no cap has limit_seconds null, which would otherwise render as "17h 16m
  // 6s of 0s used (0%)" — a real numerator over a denominator that doesn't
  // exist. Checking for the cap is what the card's purpose actually requires.
  if (!usage?.enabled || usage.limit_seconds == null) return null;

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-muted-foreground">
          {t("usage.label")}
        </span>
        <span className="text-muted-foreground">
          {t("usage.summary", {
            used: formatDuration(usage.used_seconds),
            limit: formatDuration(usage.limit_seconds ?? 0),
            percent: Math.round(usage.percent ?? 0),
          })}
        </span>
      </div>
      <Progress value={Math.min(100, usage.percent ?? 0)} />
      {usage.exceeded && (
        <p className="text-xs text-destructive">{t("usage.exceeded")}</p>
      )}
    </div>
  );
}
