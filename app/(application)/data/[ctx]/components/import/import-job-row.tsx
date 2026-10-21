"use client";

/**
 * ImportJobRow — the shared presentational display of one server-side
 * import job's `job_result` row: state badge, progress bar, counters,
 * started-by/duration metadata, error text, and its Download/Retry/Cancel
 * actions with the cancel confirm dialog.
 *
 * Shared by the Pipeline tab's Imports card (`../imports-card.tsx`, one row
 * per `<li>` in a list) and the wizard's run step (`step-run-server.tsx`, a
 * single row for the job it's following) — fix round 1 / F3: these two were
 * ~120 duplicated lines each, which is exactly how a job ended up able to
 * read differently depending on where you watched it from.
 *
 * Presentational only: every action is a callback prop, called with enough
 * to act on (the job id, the error-report key, or the whole view) — each
 * caller owns its own async logic (the mutation, the download fetch, the
 * retry hand-off) and its own in-flight state (`busy`).
 */
import { Download, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { STATE_BADGE } from "@/lib/import/job-view";
import type { ImportJobView } from "@/lib/import/job-view";

export interface ImportJobRowBusy {
  /** This job's cancel mutation is in flight. */
  cancelling?: boolean;
  /** This job's error report is being fetched for download. */
  downloading?: boolean;
  /**
   * A retry/upload is (re)starting for this same row — the wizard's run
   * step reuses one row across a retry, during which a second click would
   * start a second import (IMPORT_ALREADY_RUNNING).
   */
  starting?: boolean;
}

export interface ImportJobRowProps {
  view: ImportJobView;
  /**
   * Whether THIS viewer may cancel the job — the starter/super-admin rule
   * (a null viewer or an unknown starter also pass, letting the backend
   * decide). `view.isRunning` is checked internally, so callers only pass
   * the permission half.
   */
  canCancel: boolean;
  busy?: ImportJobRowBusy;
  onCancel?: (jobId: string) => void;
  onDownload?: (errorReportKey: string) => void;
  onRetry?: (view: ImportJobView) => void;
  /**
   * "card" (default): the Pipeline tab's Imports card — adds the
   * started-by line. "step": the wizard's run step — omits it, unchanged
   * from before this row was shared (the wizard already knows who's
   * running it; the card is the one place showing several contexts' worth
   * of jobs at a glance, where that matters).
   */
  layout?: "card" | "step";
  /**
   * Rendered between the row's metadata/error and its actions. Not part of
   * the row itself — the run step uses it for its own "keeps running in
   * the background" close hint; the card passes nothing.
   */
  hint?: React.ReactNode;
}

export function ImportJobRow({
  view,
  canCancel,
  busy,
  onCancel,
  onDownload,
  onRetry,
  layout = "card",
  hint,
}: ImportJobRowProps) {
  const t = useTranslations("knowledge");

  return (
    <div
      data-testid={`import-row-${view.id}`}
      className="flex flex-col gap-3 rounded-lg border border-input p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {view.fileName}
        </span>
        <Badge variant={STATE_BADGE[view.state]}>
          {t(`workspace.import.server.state.${view.state}`)}
        </Badge>
      </div>

      {view.progress !== null && (
        <Progress className="h-2" value={view.progress} />
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>
          {view.counters.total !== null
            ? t("workspace.import.server.run.progress", {
                processed: view.counters.processed,
                total: view.counters.total,
              })
            : t("workspace.import.server.run.progressUnknown", {
                processed: view.counters.processed,
              })}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t("workspace.import.server.run.counters", {
            created: view.counters.created,
            updated: view.counters.updated,
            failed: view.counters.failed,
            invalid: view.counters.invalid,
          })}
        </span>
        {layout === "card" && view.startedBy != null && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {t("workspace.pipeline.imports.startedBy", {
                id: view.startedBy,
              })}
            </span>
          </>
        )}
        {view.durationMs !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {t("workspace.import.server.run.duration", {
                seconds: Math.max(1, Math.round(view.durationMs / 1000)),
              })}
            </span>
          </>
        )}
      </div>

      {/* Verbatim: the worker's abort reasons (EMPTY_FILE,
          NO_MAPPABLE_COLUMNS, IMPORT_RESTARTED_AFTER_STALL: …) are the
          only explanation a failed job has. */}
      {view.error && (
        <p className="break-words text-sm text-destructive">{view.error}</p>
      )}

      {hint}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {view.errorReportKey && (
          <Button
            type="button"
            variant="outline"
            disabled={Boolean(busy?.downloading || busy?.starting)}
            onClick={() => onDownload?.(view.errorReportKey!)}
          >
            <Download aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.import.server.run.downloadReport")}
          </Button>
        )}

        {view.canRetry && (
          <Button
            type="button"
            disabled={Boolean(busy?.starting)}
            onClick={() => onRetry?.(view)}
          >
            <RotateCcw aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.import.server.run.retry")}
          </Button>
        )}

        {view.isRunning && canCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(busy?.cancelling)}
              >
                {t("workspace.import.server.run.cancel")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("workspace.import.server.run.cancelConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("workspace.import.server.run.cancelConfirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("workspace.import.server.run.cancelKeep")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onCancel?.(view.id)}
                >
                  {t("workspace.import.server.run.cancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
