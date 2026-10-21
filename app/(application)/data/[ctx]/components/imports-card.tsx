"use client";

/**
 * ImportsCard — the Pipeline tab's list of a context's server-side import
 * jobs (`GET_IMPORT_JOBS`, limit 20, spec docs/superpowers/specs/
 * 2026-10-21-server-side-bulk-import-design.md). Each row is rendered by
 * the shared `ImportJobRow` (`import/import-job-row.tsx`) — also used by
 * the wizard's run step — so a job reads the same way whether you're
 * watching it from the wizard or from here (fix round 1 / F3).
 *
 * Polling discipline (mirrors `ActivityList` in this same tab): the query
 * always fires once; `pollInterval` is 5s ONLY while at least one row is
 * still running, 0 otherwise. The card unmounts with the Pipeline tab, and
 * Apollo stops polling on unmount — nothing further to gate here.
 *
 * `onRetryImport` hands the clicked job's view up rather than driving a
 * retry mutation itself: the wizard dialog owns the retry path (its stored
 * `mapping`/`access` plumbing, `startFromKey`), so the card's only job is to
 * say WHICH job to retry.
 */

import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigContext } from "@/components/shell/config-context";
import { filesApi } from "@/lib/api/files";
import {
  CANCEL_IMPORT,
  GET_IMPORT_JOBS,
  importErrorCode,
  importErrorMessage,
  importJobFilters,
} from "@/lib/api/imports";
import {
  toImportJobView,
  type ImportJobRow as ImportJobRowData,
  type ImportJobView,
} from "@/lib/import/job-view";
import { serverImportAvailable } from "@/lib/import/mode";
import type { Context } from "@/types/models/context";

import { ImportJobRow } from "./import/import-job-row";

/** Live cadence while any job is still running; terminal-only lists don't poll. */
const POLL_INTERVAL_MS = 5000;
/** Fixed per the brief — this card is a glance list, not a paginated table. */
const IMPORT_JOBS_LIMIT = 20;

export interface ImportsCardProps {
  context: Context;
  /** Opens the wizard in retry mode for this job (workspace-shell owns the dialog). */
  onRetryImport?: (job: ImportJobView) => void;
  pollIntervalMs?: number;
}

export function ImportsCard({
  context,
  onRetryImport,
  pollIntervalMs = POLL_INTERVAL_MS,
}: ImportsCardProps) {
  const t = useTranslations("knowledge");
  const config = React.useContext(ConfigContext);
  const available = serverImportAvailable(config);
  // Read defensively: UserContext's default is null (outside the app shell),
  // and then the button stays and the backend decides — same rule as the
  // wizard's run step.
  const viewer = React.useContext(UserContext) as {
    user?: { id?: number; super_admin?: boolean };
  } | null;

  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(
    null,
  );
  // `pollInterval` itself stays 0 (a constant option, never re-derived) —
  // under `fetchPolicy: "network-only"` a CHANGING option value forces an
  // extra immediate network reobserve, which would double-fetch right as a
  // row starts running. Polling is instead driven imperatively below via
  // `startPolling`/`stopPolling`, matching the run step's own `stopPolling()`
  // call in import/step-run-server.tsx.
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(
    GET_IMPORT_JOBS,
    {
      variables: {
        filters: importJobFilters(context.id),
        limit: IMPORT_JOBS_LIMIT,
      },
      fetchPolicy: "network-only",
      pollInterval: 0,
    },
  );

  const views = React.useMemo(
    () =>
      ((data?.job_resultsPagination?.items ?? []) as ImportJobRowData[]).map(
        toImportJobView,
      ),
    [data],
  );

  React.useEffect(() => {
    if (views.some((v) => v.isRunning)) startPolling(pollIntervalMs);
    else stopPolling();
  }, [views, startPolling, stopPolling, pollIntervalMs]);

  const [cancelImport] = useMutation(CANCEL_IMPORT(context.id));

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await cancelImport({ variables: { jobResultId: jobId } });
    } catch (e) {
      // Deliberately not a generic failure path: a refused cancel (most
      // commonly NOT_AUTHORIZED — only the starter or a super admin may
      // cancel) leaves the job running, so there's nothing to refetch.
      const code = importErrorCode(e);
      toast.error(
        code === "NOT_AUTHORIZED"
          ? t("workspace.import.server.run.cancelNotAllowed")
          : code
            ? t(`workspace.import.server.errors.${code}`)
            : t("workspace.import.server.run.cancelFailed", {
                message: importErrorMessage(e),
              }),
      );
      setCancellingId(null);
      return;
    }
    setCancellingId(null);
    // The cancel itself already succeeded — a refetch failure here must not
    // read as a failed cancel (fix round 1 / F2). The row's next poll (it's
    // still "running" until this refetch lands) self-corrects, so this is
    // worth a console warning and nothing more user-facing.
    try {
      await refetch();
    } catch (e) {
      console.warn("[import] refetch after a successful cancel failed", e);
    }
  };

  // Exact approach of step-run-server.tsx's `downloadReport`, copied rather
  // than extracted into a shared helper: that component's test mocks the
  // whole `@/lib/api/files` module down to just `{ filesApi }`, so a helper
  // living in that module and imported from step-run-server.tsx would come
  // back `undefined` under that mock. Duplicating these ten lines here keeps
  // the Task 3 test untouched.
  const handleDownload = async (key: string) => {
    setDownloadingKey(key);
    try {
      const res = await filesApi.download(key);
      const json = await res.json();
      if (!json?.url) throw new Error("The download URL was missing.");
      window.open(json.url, "_blank");
    } catch (e) {
      toast.error(t("workspace.import.server.run.downloadFailed"), {
        description: importErrorMessage(e),
      });
    } finally {
      setDownloadingKey(null);
    }
  };

  const mayCancel = (view: ImportJobView) =>
    !viewer?.user ||
    viewer.user.super_admin === true ||
    view.startedBy == null ||
    view.startedBy === viewer.user.id;

  // Past jobs may exist even where the deployment can no longer start new
  // ones, so unavailability alone never hides the card — only unavailable
  // AND genuinely empty does, which keeps today's layout for tenants without
  // the feature.
  if (!available && views.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          {t("workspace.pipeline.imports.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {error && !data ? (
          // Same copy the run step uses for its own failed poll — one
          // status message for "couldn't read an import's state", not two
          // (fix round 1 / F1).
          <p className="text-sm text-destructive">
            {t("workspace.import.server.run.statusUnavailable", {
              message: error.message,
            })}
          </p>
        ) : loading && views.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : views.length === 0 ? (
          <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            {t("workspace.pipeline.imports.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {views.map((view) => (
              <li key={view.id}>
                <ImportJobRow
                  view={view}
                  canCancel={mayCancel(view)}
                  busy={{
                    cancelling: cancellingId === view.id,
                    downloading: downloadingKey === view.errorReportKey,
                  }}
                  onCancel={handleCancel}
                  onDownload={handleDownload}
                  onRetry={onRetryImport}
                  layout="card"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
