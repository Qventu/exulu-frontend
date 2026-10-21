"use client";

import { useQuery } from "@apollo/client";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UserContext } from "@/app/(application)/authenticated";
import { filesApi } from "@/lib/api/files";
import { GET_IMPORT_JOBS, importJobByIdFilters } from "@/lib/api/imports";
import { errorReportFileName, toImportJobView } from "@/lib/import/job-view";
import type {
  ImportJobRow as ImportJobRowData,
  ImportJobView,
} from "@/lib/import/job-view";
import type { BatchAccess } from "@/lib/import/types";

import { ImportJobRow } from "./import-job-row";
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
  /**
   * Back to the review step — offered only when the start itself failed AND
   * the caller has a step to go back to. Omitted on the paths that reach this
   * step without the wizard's own ones (an adopted job, the imports card's
   * Retry), where Back would land on an empty review grid.
   */
  onBack?: () => void;
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
 *
 * The row's own display (badge, progress, counters, error text, and the
 * Download/Retry/Cancel actions) is `ImportJobRow` — shared with the
 * Pipeline tab's Imports card (fix round 1 / F3). This component keeps the
 * async logic (`downloadReport`, the polling query) and the viewer-specific
 * `mayCancel` rule; `ImportJobRow` only renders what those produce.
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

  const row: ImportJobRowData | undefined =
    data?.job_resultsPagination?.items?.[0];
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

      {/* No row to show and nothing in flight: either the read failed, or it
          succeeded and this id has no row (it is gone, or a poll landed
          before the worker wrote it). Both are "we can't show you the
          status", and saying so beats an empty panel. */}
      {jobResultId && !view && !loading && (
        <p className="text-sm text-destructive">
          {t("workspace.import.server.run.statusUnavailable", {
            message:
              queryError?.message ??
              t("workspace.import.server.errors.IMPORT_NOT_FOUND"),
          })}
        </p>
      )}

      {view && (
        <ImportJobRow
          view={view}
          canCancel={mayCancel}
          busy={{ cancelling, downloading, starting }}
          onDownload={(key) => void downloadReport(key)}
          onRetry={(v) =>
            onRetry({
              s3Key: v.errorReportKey!,
              fileName: errorReportFileName(v.fileName),
              access: v.access,
            })
          }
          onCancel={() => onCancel()}
          layout="step"
          hint={
            view.isRunning ? (
              <p className="text-sm text-muted-foreground">
                {t("workspace.import.server.run.closeHint")}
              </p>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase === "error" && onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            {t("workspace.import.back")}
          </Button>
        )}

        <Button type="button" variant="outline" onClick={onClose}>
          {t("workspace.import.close")}
        </Button>
      </div>
    </div>
  );
}
