"use client";

/**
 * QueueManagement — the queue jobs panel.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1):
 * - RBAC FIX: pause / resume / drain / bulk-retry / bulk-delete / per-row
 *   retry & delete / and selection checkboxes are ALL gated on `canWrite`.
 *   The original version was readable to anyone with `evals: read`, which
 *   meant readers could pause a shared queue or schedule retry traffic.
 * - All confirmation dialogs are now the shared <ConfirmDialog /> primitive
 *   (no more 5+ hand-rolled AlertDialogs). The retry dialog preserves its
 *   "Delete the original job(s) after retrying" cascade checkbox via the
 *   primitive's `options` API.
 * - Status badges use semantic tokens (success / warning / info /
 *   destructive) instead of `bg-blue-100 / text-blue-800`-style literals.
 * - "Auto Refresh" spinner badge replaced with <RelativeTime /> "Updated Ns
 *   ago" — the spinner gave no useful signal beyond "polling exists".
 * - Empty state goes through the shared <EmptyState /> primitive.
 * - Pagination is hidden when only one page is available.
 * - Below `md`, the table collapses to a card stack (a11y win — long rows
 *   reflow instead of horizontal-scrolling on phones); the copy-id action
 *   is always visible there, not hover-gated.
 * - "succesfull" → "successful" — typo fixed in en.json (key
 *   `evals.queue.retentionFootnote`).
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { format } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Copy,
  Droplet,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  GET_JOBS,
  GET_QUEUE,
  DELETE_JOB,
  DRAIN_QUEUE,
  PAUSE_QUEUE,
  RESUME_QUEUE,
} from "@/queries/queries";
import type { QueueJob } from "@/types/models/job";
import type { JobStatus } from "@/types/models/job-result";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { EmptyState } from "@/components/primitives/empty-state";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TextPreview } from "@/components/custom/text-preview";
import { DoubleArrowLeftIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface QueueManagementProps {
  queueName: string;
  /** RBAC gate for ALL mutating actions in this panel. */
  canWrite: boolean;
  nameGenerator: (job: QueueJob) => string;
  retryJob: (job: QueueJob) => void;
}

function statusBadgeClass(state: string): string {
  switch (state) {
    case "active":
      return "bg-info/10 text-info border-info/30";
    case "waiting":
      return "bg-warning/10 text-warning border-warning/30";
    case "completed":
      return "bg-success/10 text-success border-success/30";
    case "failed":
    case "stuck":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "delayed":
      return "bg-warning/10 text-warning border-warning/30";
    case "paused":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function QueueManagement({
  queueName,
  canWrite,
  nameGenerator,
  retryJob,
}: QueueManagementProps) {
  const t = useTranslations("evals.queue");
  const [confirm, setConfirm] = useState<
    | { kind: "pause" }
    | { kind: "resume" }
    | { kind: "drain" }
    | { kind: "deleteJobs"; jobs: QueueJob[] }
    | { kind: "retryJobs"; jobs: QueueJob[] }
    | null
  >(null);
  const [status, setStatus] = useState<JobStatus>("completed");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const {
    data: queueData,
    loading: loadingQueue,
    refetch: refetchQueue,
  } = useQuery(GET_QUEUE, {
    variables: { queue: queueName },
    pollInterval: 5000,
    onCompleted: () => setLastUpdated(new Date()),
  });

  const {
    data: jobsData,
    loading: loadingJobs,
    refetch: refetchJobs,
  } = useQuery(GET_JOBS, {
    variables: {
      queue: queueName,
      statusses: status,
      page,
      limit,
    },
    pollInterval: 5000,
    onCompleted: () => setLastUpdated(new Date()),
  });

  const [deleteJob] = useMutation(DELETE_JOB, {
    onError: (error) => {
      toast.error(t("deleteJobsError.title"), { description: error.message });
    },
  });

  const [pauseQueue] = useMutation(PAUSE_QUEUE, {
    onCompleted: () => {
      toast.success(t("pauseSuccess.title"));
      refetchQueue();
    },
    onError: (error) => {
      toast.error(t("pauseError.title"), { description: error.message });
    },
  });

  const [resumeQueue] = useMutation(RESUME_QUEUE, {
    onCompleted: () => {
      toast.success(t("resumeSuccess.title"));
      refetchQueue();
    },
    onError: (error) => {
      toast.error(t("resumeError.title"), { description: error.message });
    },
  });

  const [drainQueue] = useMutation(DRAIN_QUEUE, {
    onCompleted: () => {
      toast.success(t("drainSuccess.title"));
      refetchQueue();
      refetchJobs();
    },
    onError: (error) => {
      toast.error(t("drainError.title"), { description: error.message });
    },
  });

  const queue = queueData?.queue;
  const jobs: {
    items: QueueJob[];
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  } = jobsData?.jobs || {
    items: [],
    pageInfo: {
      pageCount: 0,
      itemCount: 0,
      currentPage: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };

  // Selecting jobs is itself a write-action prerequisite (it feeds the bulk
  // delete/retry bar). Clear any stale selection if `canWrite` flips off.
  useEffect(() => {
    if (!canWrite && selectedJobs.size > 0) setSelectedJobs(new Set());
  }, [canWrite, selectedJobs.size]);

  const toggleJobSelection = (jobId: string) => {
    const next = new Set(selectedJobs);
    if (next.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    setSelectedJobs(next);
  };

  const toggleAllJobs = () => {
    const selectable = jobs.items.filter((j) => j.state !== "active");
    if (selectedJobs.size === selectable.length && selectable.length > 0) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(selectable.map((j) => j.id)));
    }
  };

  const performDeleteJobs = async (jobsToDelete: QueueJob[]) => {
    const withoutId = jobsToDelete.filter((j) => !j.id);
    if (withoutId.length > 0) {
      toast.error(t("deleteJobsError.title"), {
        description: "Some jobs have no ID.",
      });
      throw new Error("missing id");
    }
    await Promise.all(
      jobsToDelete.map((j) =>
        deleteJob({ variables: { queue: queueName, id: j.id } }),
      ),
    );
    toast.success(t("deleteJobsSuccess.title", { count: jobsToDelete.length }));
    refetchJobs();
    refetchQueue();
    setSelectedJobs(new Set());
  };

  const performRetryJobs = async (
    jobsToRetry: QueueJob[],
    deleteOriginal: boolean,
  ) => {
    for (const j of jobsToRetry) retryJob(j);
    if (deleteOriginal) {
      await Promise.all(
        jobsToRetry
          .filter((j) => j.id)
          .map((j) =>
            deleteJob({ variables: { queue: queueName, id: j.id } }),
          ),
      );
    }
    toast.success(t("retryJobsSuccess.title", { count: jobsToRetry.length }));
    refetchJobs();
    refetchQueue();
    setSelectedJobs(new Set());
  };

  if (loadingQueue && loadingJobs && !queue) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const queueStatus = !queue
    ? null
    : queue.isPaused
      ? { label: t("stats.paused"), cls: statusBadgeClass("paused") }
      : queue.isMaxed
        ? { label: t("stats.maxed"), cls: statusBadgeClass("failed") }
        : { label: t("stats.active"), cls: statusBadgeClass("completed") };

  const showPagination = (jobs.pageInfo?.pageCount ?? 0) > 1;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>{t("panel.title", { queueName })}</CardTitle>
            </div>
            {queue && canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConfirm({ kind: queue.isPaused ? "resume" : "pause" })
                  }
                >
                  {queue.isPaused ? (
                    <Play aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Pause aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  {queue.isPaused ? t("resume.trigger") : t("pause.trigger")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm({ kind: "drain" })}
                >
                  <Droplet aria-hidden="true" className="mr-2 h-4 w-4" />
                  {t("drain.trigger")}
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Queue Stats */}
          {queue ? (
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    {t("stats.status")}:
                  </div>
                  {queueStatus ? (
                    <Badge variant="outline" className={queueStatus.cls}>
                      {queueStatus.label}
                    </Badge>
                  ) : null}
                </div>
                <div className="hidden h-8 w-px bg-border sm:block" />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">
                      {t("stats.queueConcurrency")}
                    </div>
                    <div className="text-sm font-semibold">
                      {queue.concurrency?.queue || t("stats.none")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">
                      {t("stats.workerConcurrency")}
                    </div>
                    <div className="text-sm font-semibold">
                      {queue.concurrency?.worker || t("stats.none")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">
                      {t("stats.jobTimeout")}
                    </div>
                    <div className="text-sm font-semibold">
                      {queue.timeoutInSeconds || t("stats.none")}s
                    </div>
                  </div>
                </div>
                <div className="hidden h-8 w-px bg-border sm:block" />
                <div className="flex flex-col gap-1">
                  <div className="text-xs text-muted-foreground">
                    {t("stats.rateLimit")}
                  </div>
                  <div className="text-sm font-semibold">
                    {queue.ratelimit || t("stats.none")}{" "}
                    {t("stats.rateLimitUnit")}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Tabs
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as JobStatus);
                    setPage(1);
                  }}
                  className="w-auto"
                >
                  <TabsList className="flex-wrap">
                    <TabsTrigger value="active" className="gap-1.5">
                      <span>{t("tabs.active")}</span>
                      <Badge
                        variant="secondary"
                        className={cn("ml-1", statusBadgeClass("active"))}
                      >
                        {queue.jobs?.active || 0}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="waiting" className="gap-1.5">
                      <span>{t("tabs.waiting")}</span>
                      <Badge
                        variant="secondary"
                        className={cn("ml-1", statusBadgeClass("waiting"))}
                      >
                        {queue.jobs?.waiting || 0}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="failed" className="gap-1.5">
                      <span>{t("tabs.failed")}</span>
                      <Badge
                        variant="secondary"
                        className={cn("ml-1", statusBadgeClass("failed"))}
                      >
                        {queue.jobs?.failed || 0}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="gap-1.5">
                      <span>{t("tabs.completed")}</span>
                      <Badge
                        variant="secondary"
                        className={cn("ml-1", statusBadgeClass("completed"))}
                      >
                        {queue.jobs?.completed || 0}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="mt-2 text-xs text-muted-foreground">
                  * {t("retentionFootnote")}
                </p>
              </div>
            </div>
          ) : null}

          {/* Jobs */}
          <div>
            <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold">{t("jobs.title")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("jobs.description", { queueName })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t("jobs.pageSize")}
                  </p>
                  <Select
                    value={`${limit}`}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={limit} />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      {[20, 50, 100, 200].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canWrite && selectedJobs.size > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const list = jobs.items.filter((j) =>
                          selectedJobs.has(j.id),
                        );
                        setConfirm({ kind: "retryJobs", jobs: list });
                      }}
                    >
                      <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
                      {t("jobs.bulkRetry", { count: selectedJobs.size })}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const list = jobs.items.filter((j) =>
                          selectedJobs.has(j.id),
                        );
                        setConfirm({ kind: "deleteJobs", jobs: list });
                      }}
                    >
                      <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                      {t("jobs.bulkDelete", { count: selectedJobs.size })}
                    </Button>
                  </>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Updated <RelativeTime date={lastUpdated} live />
                </span>
              </div>
            </div>

            <div className="rounded-lg border">
              {loadingJobs && jobs.items.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
                </div>
              ) : jobs.items?.length === 0 ? (
                <EmptyState
                  variant="quiet"
                  title={t("jobs.empty.title")}
                  description={t("jobs.empty.description")}
                />
              ) : (
                <>
                  {/* md+ : table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {canWrite ? (
                            <TableHead className="w-12">
                              <Checkbox
                                checked={
                                  jobs.items.filter(
                                    (j) => j.state !== "active",
                                  ).length > 0 &&
                                  selectedJobs.size ===
                                    jobs.items.filter(
                                      (j) => j.state !== "active",
                                    ).length
                                }
                                onCheckedChange={toggleAllJobs}
                                aria-label={t("jobs.selectAll")}
                              />
                            </TableHead>
                          ) : null}
                          <TableHead>{t("jobs.columns.name")}</TableHead>
                          <TableHead>{t("jobs.columns.id")}</TableHead>
                          <TableHead>{t("jobs.columns.attempts")}</TableHead>
                          <TableHead>{t("jobs.columns.created")}</TableHead>
                          <TableHead>{t("jobs.columns.processed")}</TableHead>
                          <TableHead>{t("jobs.columns.finished")}</TableHead>
                          <TableHead>{t("jobs.columns.inputs")}</TableHead>
                          <TableHead>{t("jobs.columns.outputs")}</TableHead>
                          <TableHead className="text-right">
                            {t("jobs.columns.actions")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.items.map((job, index) => (
                          <TableRow key={index}>
                            {canWrite ? (
                              <TableCell>
                                <Checkbox
                                  checked={selectedJobs.has(job.id)}
                                  onCheckedChange={() =>
                                    toggleJobSelection(job.id)
                                  }
                                  disabled={job.state === "active"}
                                  aria-label={t("jobs.selectOne", {
                                    name: nameGenerator(job),
                                  })}
                                />
                              </TableCell>
                            ) : null}
                            <TableCell className="max-w-[200px] truncate font-medium">
                              {nameGenerator(job)}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(job.id);
                                      toast.success(
                                        t("jobs.copySuccess.title"),
                                        {
                                          description: t(
                                            "jobs.copySuccess.description",
                                            { id: job.id },
                                          ),
                                        },
                                      );
                                    }}
                                    className="max-w-[120px] cursor-copy truncate rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                  >
                                    {job.id}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t("jobs.copyId")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{job.attemptsMade}</TableCell>
                            <TableCell>
                              {job.timestamp
                                ? format(
                                    new Date(job.timestamp),
                                    "MMM d, yyyy HH:mm:ss",
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {job.processedOn
                                ? format(
                                    new Date(job.processedOn),
                                    "MMM d, yyyy HH:mm:ss",
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {job.finishedOn
                                ? format(
                                    new Date(job.finishedOn),
                                    "MMM d, yyyy HH:mm:ss",
                                  )
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {job.data ? (
                                <div className="max-w-[120px] truncate text-xs text-muted-foreground">
                                  <TextPreview
                                    sliceLength={50}
                                    text={JSON.stringify(job.data)}
                                  />
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {job.failedReason ? (
                                <div className="max-w-[120px] truncate text-xs text-destructive">
                                  <TextPreview
                                    sliceLength={50}
                                    text={"Error: " + job.failedReason}
                                  />
                                </div>
                              ) : (
                                <div className="max-w-[120px] truncate text-xs text-muted-foreground">
                                  <TextPreview
                                    sliceLength={50}
                                    text={JSON.stringify(job.returnvalue)}
                                  />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canWrite ? (
                                <div className="flex justify-end gap-1">
                                  {job.state === "failed" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setConfirm({
                                          kind: "retryJobs",
                                          jobs: [job],
                                        })
                                      }
                                    >
                                      <RefreshCcw
                                        aria-hidden="true"
                                        className="mr-1 h-4 w-4 text-info"
                                      />
                                      {t("jobs.retry")}
                                    </Button>
                                  ) : null}
                                  {job.state !== "active" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      aria-label={t("jobs.delete")}
                                      onClick={() =>
                                        setConfirm({
                                          kind: "deleteJobs",
                                          jobs: [job],
                                        })
                                      }
                                    >
                                      <Trash2
                                        aria-hidden="true"
                                        className="h-4 w-4 text-destructive"
                                      />
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* < md : card stack */}
                  <ul className="divide-y md:hidden">
                    {jobs.items.map((job, index) => (
                      <li key={index} className="flex flex-col gap-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {nameGenerator(job)}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {job.id}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(job.state)}
                          >
                            {job.state}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>
                            Attempts:{" "}
                            <span className="font-medium text-foreground">
                              {job.attemptsMade}
                            </span>
                          </span>
                          {job.timestamp ? (
                            <span>
                              Created:{" "}
                              <span className="font-medium text-foreground">
                                {format(new Date(job.timestamp), "MMM d HH:mm")}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {/* Copy-id is ALWAYS visible on phones — no hover gating. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(job.id);
                              toast.success(t("jobs.copySuccess.title"));
                            }}
                          >
                            <Copy
                              aria-hidden="true"
                              className="mr-1 h-3 w-3"
                            />
                            {t("jobs.copyId")}
                          </Button>
                          {canWrite && job.state === "failed" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirm({
                                  kind: "retryJobs",
                                  jobs: [job],
                                })
                              }
                            >
                              <RefreshCcw
                                aria-hidden="true"
                                className="mr-1 h-3 w-3 text-info"
                              />
                              {t("jobs.retry")}
                            </Button>
                          ) : null}
                          {canWrite && job.state !== "active" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirm({
                                  kind: "deleteJobs",
                                  jobs: [job],
                                })
                              }
                            >
                              <Trash2
                                aria-hidden="true"
                                className="mr-1 h-3 w-3 text-destructive"
                              />
                              {t("jobs.delete")}
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {showPagination ? (
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="flex-1 text-sm text-muted-foreground">
                    ({jobs.pageInfo.itemCount} total)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden size-8 p-0 lg:flex"
                      onClick={() => {
                        setPage(1);
                        refetchJobs();
                      }}
                      disabled={!jobs.pageInfo.hasPreviousPage}
                    >
                      <span className="sr-only">first</span>
                      <DoubleArrowLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => {
                        setPage(
                          jobs.pageInfo.hasPreviousPage
                            ? jobs.pageInfo.currentPage - 1
                            : 1,
                        );
                        refetchJobs();
                      }}
                      disabled={!jobs.pageInfo.hasPreviousPage}
                    >
                      <span className="sr-only">previous</span>
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="size-8 p-0"
                      onClick={() => {
                        setPage(
                          jobs.pageInfo.hasNextPage
                            ? jobs.pageInfo.currentPage + 1
                            : 1,
                        );
                        refetchJobs();
                      }}
                      disabled={!jobs.pageInfo.hasNextPage}
                    >
                      <span className="sr-only">next</span>
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmations */}
      <ConfirmDialog
        open={confirm?.kind === "pause"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("pauseConfirm.title")}
        description={t("pauseConfirm.description", { queueName })}
        variant="default"
        confirmLabel={t("pause.trigger")}
        onConfirm={async () => {
          await pauseQueue({ variables: { queue: queueName } });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "resume"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("resumeConfirm.title")}
        description={t("resumeConfirm.description", { queueName })}
        variant="default"
        confirmLabel={t("resume.trigger")}
        onConfirm={async () => {
          await resumeQueue({ variables: { queue: queueName } });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "drain"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("drainConfirm.title")}
        description={t("drainConfirm.description", { queueName })}
        variant="destructive"
        confirmLabel={t("drain.trigger")}
        onConfirm={async () => {
          await drainQueue({ variables: { queue: queueName } });
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "deleteJobs"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("deleteJobsConfirm.title", {
          count:
            confirm?.kind === "deleteJobs" ? confirm.jobs.length : 0,
        })}
        description={
          confirm?.kind === "deleteJobs"
            ? confirm.jobs.length === 1
              ? t("deleteJobsConfirm.descriptionSingle", {
                  name: confirm.jobs[0]?.name ?? confirm.jobs[0]?.id ?? "",
                })
              : t("deleteJobsConfirm.descriptionMany", {
                  count: confirm.jobs.length,
                })
            : ""
        }
        variant="destructive"
        onConfirm={async () => {
          if (confirm?.kind !== "deleteJobs") return;
          await performDeleteJobs(confirm.jobs);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "retryJobs"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("retryJobsConfirm.title", {
          count: confirm?.kind === "retryJobs" ? confirm.jobs.length : 0,
        })}
        description={
          confirm?.kind === "retryJobs"
            ? confirm.jobs.length === 1
              ? t("retryJobsConfirm.descriptionSingle")
              : t("retryJobsConfirm.descriptionMany", {
                  count: confirm.jobs.length,
                })
            : ""
        }
        variant="default"
        confirmLabel={t("retryJobsConfirm.confirm")}
        options={
          confirm?.kind === "retryJobs"
            ? [
                {
                  id: "deleteOriginal",
                  label: t("retryJobsConfirm.deleteOriginal", {
                    count: confirm.jobs.length,
                  }),
                },
              ]
            : undefined
        }
        onConfirm={async (selectedIds) => {
          if (confirm?.kind !== "retryJobs") return;
          const deleteOriginal = selectedIds?.includes("deleteOriginal") ?? false;
          await performRetryJobs(confirm.jobs, deleteOriginal);
        }}
      />
    </TooltipProvider>
  );
}
