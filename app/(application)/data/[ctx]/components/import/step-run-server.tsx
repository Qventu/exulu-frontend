"use client";

import { useQuery } from "@apollo/client";
import { AlertCircle, Download, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { UserContext } from "@/app/(application)/authenticated";
import { filesApi } from "@/lib/api/files";
import { GET_IMPORT_JOBS, importJobByIdFilters } from "@/lib/api/imports";
import {
  STATE_BADGE,
  errorReportFileName,
  toImportJobView,
} from "@/lib/import/job-view";
import type { ImportJobRow, ImportJobView } from "@/lib/import/job-view";
import type { BatchAccess } from "@/lib/import/types";

import type {
  ServerImportErrorCode,
  ServerImportPhase,
} from "./use-server-import";

/** Live cadence while the job runs; terminal rows stop the polling. */
const POLL_INTERVAL_MS = 2000;

export interface StepRunServerProps {
  /** The job to follow; null while the upload/start is still in flight. */
  jobResultId: string | null;
  /** Shown before the job row exists (the file being uploaded). */
  fileName: string;
  phase: ServerImportPhase;
  error: string | null;
  errorCode: ServerImportErrorCode | null;
  cancelling: boolean;
  onCancel: () => void;
  /**
   * Retry the failed rows from the error report the job left behind, with
   * the access that run was started with (null when the row carries none).
   */
  onRetry: (args: {
    s3Key: string;
    fileName: string;
    access: BatchAccess | null;
  }) => void;
  /** Back to the review step — offered only when the start itself failed. */
  onBack: () => void;
  onClose: () => void;
  /** Fired once, when the job reaches a terminal state. */
  onFinished?: (view: ImportJobView) => void;
  pollIntervalMs?: number;
}

/**
 * The wizard's `run` step: a server-side import's progress, polled from its
 * `job_result` row.
 *
 * The actions live in this component rather than the dialog's footer because
 * every one of them depends on the polled row (cancel only while running,
 * error report only when the worker wrote one) — which only this component
 * sees. Closing the wizard here does NOT cancel the job: the worker keeps
 * going, which is what the Close hint says (Review Focus 4).
 */
export function StepRunServer({
  jobResultId,
  fileName,
  phase,
  error,
  errorCode,
  cancelling,
  onCancel,
  onRetry,
  onBack,
  onClose,
  onFinished,
  pollIntervalMs = POLL_INTERVAL_MS,
}: StepRunServerProps) {
  const t = useTranslations("knowledge");
  const [downloading, setDownloading] = React.useState(false);
  // A retry re-uses this step: while its mutation is in flight the previous
  // job's report/retry buttons are still on screen, and a second click would
  // start a second import (IMPORT_ALREADY_RUNNING).
  const starting = phase === "uploading" || phase === "starting";
  // Read defensively: UserContext's default is null (outside the app shell),
  // and then the button stays and the backend decides.
  const viewer = React.useContext(UserContext) as {
    user?: { id?: number; super_admin?: boolean };
  } | null;

  // Polling stops as soon as THIS job's row is terminal — a finished import
  // leaves no request on the wire for as long as the dialog stays open. The
  // flag carries the job id rather than a bare boolean, so a retry (a new
  // jobResultId in the same mounted step) starts polling again.
  const [terminalJobId, setTerminalJobId] = React.useState<string | null>(null);
  const finished = terminalJobId !== null && terminalJobId === jobResultId;
  const {
    data,
    loading,
    error: queryError,
    stopPolling,
  } = useQuery(GET_IMPORT_JOBS, {
    variables: {
      filters: importJobByIdFilters(jobResultId ?? ""),
      limit: 1,
    },
    skip: !jobResultId,
    fetchPolicy: "network-only",
    pollInterval: finished ? 0 : pollIntervalMs,
  });

  const row: ImportJobRow | undefined = data?.job_resultsPagination?.items?.[0];
  // Apollo can still hold the previous job's row for a render after a retry
  // swapped the id; rendering it would offer that job's retry button again.
  const view = React.useMemo(
    () => (row && row.id === jobResultId ? toImportJobView(row) : null),
    [row, jobResultId],
  );

  React.useEffect(() => {
    if (!view || view.isRunning) return;
    setTerminalJobId(view.id);
    stopPolling();
  }, [view, stopPolling]);

  // One report per job, however many polls land after it finished.
  const reportedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!view || view.isRunning) return;
    if (reportedRef.current === view.id) return;
    reportedRef.current = view.id;
    onFinished?.(view);
  }, [view, onFinished]);

  const downloadReport = async (key: string) => {
    setDownloading(true);
    try {
      const res = await filesApi.download(key);
      const json = await res.json();
      if (!json?.url) throw new Error("The download URL was missing.");
      window.open(json.url, "_blank");
    } catch (e) {
      toast.error(t("workspace.import.server.run.downloadFailed"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDownloading(false);
    }
  };

  // Only the starter or a super admin may cancel (the backend throws
  // NOT_AUTHORIZED otherwise), so nobody else is offered the button.
  const mayCancel =
    !viewer?.user ||
    viewer.user.super_admin === true ||
    view?.startedBy == null ||
    view.startedBy === viewer.user.id;

  const startError = errorCode
    ? t(`workspace.import.server.errors.${errorCode}`)
    : t("workspace.import.server.errors.generic", { message: error ?? "" });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {(phase === "uploading" || phase === "starting") && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          <span>
            {phase === "uploading"
              ? t("workspace.import.server.run.uploading", { name: fileName })
              : t("workspace.import.server.run.starting")}
          </span>
        </div>
      )}

      {phase === "error" && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="size-4" />
          <AlertTitle>{t("workspace.import.server.run.errorTitle")}</AlertTitle>
          <AlertDescription>{startError}</AlertDescription>
        </Alert>
      )}

      {jobResultId && !view && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          <span>{t("workspace.import.server.run.loadingJob")}</span>
        </div>
      )}

      {jobResultId && !view && queryError && (
        <p className="text-sm text-destructive">
          {t("workspace.import.server.run.statusUnavailable", {
            message: queryError.message,
          })}
        </p>
      )}

      {view && (
        <section className="flex flex-col gap-3 rounded-lg border border-input p-4">
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
        </section>
      )}

      {view?.isRunning && (
        <p className="text-sm text-muted-foreground">
          {t("workspace.import.server.run.closeHint")}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase === "error" && (
          <Button type="button" variant="outline" onClick={onBack}>
            {t("workspace.import.back")}
          </Button>
        )}

        {view?.errorReportKey && (
          <Button
            type="button"
            variant="outline"
            disabled={downloading || starting}
            onClick={() => void downloadReport(view.errorReportKey!)}
          >
            <Download aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.import.server.run.downloadReport")}
          </Button>
        )}

        {view?.canRetry && (
          <Button
            type="button"
            disabled={starting}
            onClick={() =>
              onRetry({
                s3Key: view.errorReportKey!,
                fileName: errorReportFileName(view.fileName),
                access: view.access,
              })
            }
          >
            <RotateCcw aria-hidden="true" className="mr-2 size-4" />
            {t("workspace.import.server.run.retry")}
          </Button>
        )}

        {view?.isRunning && mayCancel && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={cancelling}>
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
                  onClick={() => onCancel()}
                >
                  {t("workspace.import.server.run.cancel")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button type="button" variant="outline" onClick={onClose}>
          {t("workspace.import.close")}
        </Button>
      </div>
    </div>
  );
}
