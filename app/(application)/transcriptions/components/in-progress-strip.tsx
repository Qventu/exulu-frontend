"use client";

/**
 * InProgressStrip — the home page's collapsed "N in progress" row (task-8
 * brief, Interfaces block — the prop contract is binding).
 *
 * Running jobs (recording / queued / transcribing) collapse behind a single
 * disclosure button. Failed jobs are a different story: a problem is never
 * folded away, so they always render below the strip, whether or not it is
 * expanded, with their existing recovery action (JobRow already renders the
 * "already saved as …" link via `recoveredBy`).
 */
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { StatusDot } from "@/components/primitives/status-dot";
import { cn } from "@/lib/utils";

import { JobRow } from "./job-row";
import { findRecoveredJob, type Job, type TranscriptRow } from "../types";

export interface InProgressStripProps {
  /** recording | queued | transcribing rows, collapsed behind "N in progress". */
  running: TranscriptRow[];
  /** Never folded away — always rendered below the strip. */
  failed: TranscriptRow[];
  /** From useTranscripts; fed to findRecoveredJob per failed row. */
  recoveredJobs: Job[];
  onChanged: () => void;
}

const RUNNING_STATE_ORDER = ["recording", "queued", "transcribing"] as const;

/** Narrows to rows that actually carry the job payload JobRow needs. */
function withJob(rows: TranscriptRow[]): (TranscriptRow & { job: Job })[] {
  return rows.filter(
    (row): row is TranscriptRow & { job: Job } => row.job !== undefined,
  );
}

export function InProgressStrip({
  running,
  failed,
  recoveredJobs,
  onChanged,
}: InProgressStripProps) {
  const t = useTranslations("transcriptions");
  const [expanded, setExpanded] = React.useState(false);

  const runningJobs = withJob(running);
  const failedJobs = withJob(failed);

  if (runningJobs.length === 0 && failedJobs.length === 0) return null;

  // Runs never open a review sheet from here — a running/queued/transcribing
  // or failed job is never in "awaiting_review" or "saved" state, the only
  // two JobRow branches that call onReview.
  const noopReview = () => {};

  const counts: Partial<Record<TranscriptRow["state"], number>> = {};
  for (const row of runningJobs) {
    counts[row.state] = (counts[row.state] ?? 0) + 1;
  }
  const summary = RUNNING_STATE_ORDER.filter((state) => counts[state]).map(
    (state) => `${counts[state]} ${t(`state.${state}`).toLowerCase()}`,
  ).join(" · ");

  return (
    <div className="space-y-2">
      {runningJobs.length > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={
            expanded ? t("inProgress.collapse") : t("inProgress.expand")
          }
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full min-h-11 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
        >
          <StatusDot status="muted" pulse />
          <span className="font-medium">
            {t("inProgress.label", { count: runningJobs.length })}
          </span>
          {summary && (
            <span className="truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}

      {expanded && runningJobs.length > 0 && (
        <ul className="space-y-2">
          {runningJobs.map((row) => (
            <JobRow
              key={row.id}
              job={row.job}
              onReview={noopReview}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {failedJobs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("state.failed")}
          </h2>
          <ul className="space-y-2">
            {failedJobs.map((row) => (
              <JobRow
                key={row.id}
                job={row.job}
                onReview={noopReview}
                onChanged={onChanged}
                recoveredBy={findRecoveredJob(row.job, recoveredJobs)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
