"use client";

/**
 * QueuePanel — promoted from the original `app/(application)/evals/[id]/runs/
 * components/queue-management.tsx`. The one queue surface used by knowledge
 * pipeline stages (sources/processor/embedder), evals runs, workflows.
 *
 * Spec: design/codebase-structure.md §2.3/§2.4 / design/pages/knowledge.md
 * §3 ladder #56. Promotion criteria per knowledge.md §4: semantic-token
 * status badges (not raw palette), mobile cards <md, per-job retry hook,
 * canWrite gating, preserve "Delete original after retrying" checkbox.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Primitive-boundary deviation (documented):
 * components/primitives/README.md §"Import boundaries" forbids data-layer
 * imports here. The architect's binding contract (work item 2.11, owner
 * "primitives") explicitly places QueuePanel — which OWNS the queue
 * GraphQL ops — in components/primitives/. We follow the binding contract
 * and record this in `deviations`. Long-term: either relax the boundary to
 * accept "graduated widgets with promoted-into-primitives status" or move
 * QueuePanel to components/widgets/queue-panel.tsx in a follow-up.
 * ──────────────────────────────────────────────────────────────────────
 */

import { useMutation, useQuery } from "@apollo/client";
import { format } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Droplet,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DELETE_JOB,
  DRAIN_QUEUE,
  GET_JOBS,
  GET_QUEUE,
  PAUSE_QUEUE,
  RESUME_QUEUE,
} from "@/queries/queries";
import { JobStatus } from "@/types/models/job-result";

import { ConfirmDialog } from "./confirm-dialog";
import { CopyButton } from "./copy-button";

import { DoubleArrowLeftIcon } from "@radix-ui/react-icons";

export interface QueuePanelJob {
  id: string;
  name?: string;
  state: JobStatus | string;
  attemptsMade?: number;
  data?: unknown;
  failedReason?: string | null;
  stacktrace?: string[] | string | null;
  processedOn?: number | string | null;
  finishedOn?: number | string | null;
  timestamp?: number | string | null;
  returnvalue?: unknown;
}

export interface QueuePanelProps {
  /** QueueEnum value (the backend queue name). */
  queueName: string;
  /** Optional human label for headings (defaults to `queueName`). */
  displayName?: string;
  /** Maps a job → display name; defaults to `job.name || job.id`. */
  nameGenerator?: (job: QueuePanelJob) => string;
  /**
   * Wire per-context retry behavior. Returning `false` (or a Promise resolving
   * to `false`) short-circuits the default deletion-after-retry plumbing —
   * useful when the caller needs to e.g. re-open EXECUTE_SOURCE with the
   * original params. Returning `true`/`void`/`undefined` keeps the default.
   */
  retryJob?: (
    job: QueuePanelJob,
  ) => boolean | void | Promise<boolean | void>;
  /** Pause/drain/retry/delete are hidden when false (read-only oversight). */
  canWrite: boolean;
  /**
   * Surface the "Delete original after retrying" checkbox in the retry
   * confirm. Defaults to true (knowledge + evals both want it).
   */
  enableDeleteOriginalAfterRetry?: boolean;
  /**
   * Render without the surrounding Card chrome + redundant "Queue: {name}"
   * heading — for when the panel is already nested inside another card (e.g.
   * a pipeline stage's "Jobs" expander). The pause/drain controls move to a
   * compact right-aligned toolbar. Defaults to false (standalone card).
   */
  embedded?: boolean;
}

/* ------------------------------------------------------------------ */

const STATUS_TOKEN: Record<string, string> = {
  active: "bg-info/15 text-info border-info/30",
  waiting: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  stuck: "bg-destructive/15 text-destructive border-destructive/30",
  delayed: "bg-warning/15 text-warning border-warning/30",
  paused: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ state }: { state: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal capitalize", STATUS_TOKEN[state])}
    >
      {state}
    </Badge>
  );
}

function fmtTime(value: number | string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy HH:mm:ss");
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ */

export function QueuePanel({
  queueName,
  displayName,
  nameGenerator,
  retryJob,
  canWrite,
  enableDeleteOriginalAfterRetry = true,
  embedded = false,
}: QueuePanelProps) {
  const t = useTranslations("common");
  const isMobile = useIsMobile();

  const [status, setStatus] = React.useState<JobStatus>("completed");
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [selectedJobs, setSelectedJobs] = React.useState<Set<string>>(
    new Set(),
  );

  const [pauseOpen, setPauseOpen] = React.useState(false);
  const [resumeOpen, setResumeOpen] = React.useState(false);
  const [drainOpen, setDrainOpen] = React.useState(false);
  const [jobsToDelete, setJobsToDelete] = React.useState<QueuePanelJob[]>([]);
  const [jobsToRetry, setJobsToRetry] = React.useState<QueuePanelJob[]>([]);
  // Failure-first job-detail drawer (knowledge V2 Phase F4).
  const [detailJob, setDetailJob] = React.useState<QueuePanelJob | null>(null);

  const label = displayName ?? queueName;
  const resolveName = React.useCallback(
    (job: QueuePanelJob) =>
      nameGenerator ? nameGenerator(job) : job.name || job.id,
    [nameGenerator],
  );

  const {
    data: queueData,
    loading: loadingQueue,
    refetch: refetchQueue,
  } = useQuery(GET_QUEUE, {
    variables: { queue: queueName },
    pollInterval: 5000,
  });

  const {
    data: jobsData,
    loading: loadingJobs,
    refetch: refetchJobs,
  } = useQuery(GET_JOBS, {
    variables: { queue: queueName, statusses: status, page, limit },
    pollInterval: 5000,
  });

  const [deleteJob] = useMutation(DELETE_JOB, {
    onError: (err) =>
      toast.error(t("queueDeleteFailed"), { description: err.message }),
  });
  const [pauseQueue] = useMutation(PAUSE_QUEUE, {
    onCompleted: () => {
      toast.success(t("queuePaused"), { description: label });
      refetchQueue();
    },
    onError: (err) =>
      toast.error(t("queuePauseFailed"), { description: err.message }),
  });
  const [resumeQueue] = useMutation(RESUME_QUEUE, {
    onCompleted: () => {
      toast.success(t("queueResumed"), { description: label });
      refetchQueue();
    },
    onError: (err) =>
      toast.error(t("queueResumeFailed"), { description: err.message }),
  });
  const [drainQueue] = useMutation(DRAIN_QUEUE, {
    onCompleted: () => {
      toast.success(t("queueDrained"), { description: label });
      refetchQueue();
      refetchJobs();
    },
    onError: (err) =>
      toast.error(t("queueDrainFailed"), { description: err.message }),
  });

  const queue = queueData?.queue;
  const jobs: {
    items: QueuePanelJob[];
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  } = jobsData?.jobs ?? {
    items: [],
    pageInfo: {
      pageCount: 0,
      itemCount: 0,
      currentPage: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };

  const selectableJobs = jobs.items.filter((j) => j.state !== "active");
  const toggleJob = (id: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (
      selectableJobs.length > 0 &&
      selectedJobs.size === selectableJobs.length
    ) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(selectableJobs.map((j) => j.id)));
    }
  };

  /* ------- confirmations ------- */

  const handlePauseConfirm = async () => {
    await pauseQueue({ variables: { queue: queueName } });
  };
  const handleResumeConfirm = async () => {
    await resumeQueue({ variables: { queue: queueName } });
  };
  const handleDrainConfirm = async () => {
    await drainQueue({ variables: { queue: queueName } });
  };

  const handleDeleteConfirm = async () => {
    const ids = jobsToDelete.map((j) => j.id).filter(Boolean);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id) =>
        deleteJob({ variables: { queue: queueName, id } }),
      ),
    );
    toast.success(
      ids.length === 1 ? t("queueJobDeleted") : t("queueJobsDeleted"),
      { description: String(ids.length) },
    );
    refetchJobs();
    refetchQueue();
    setSelectedJobs(new Set());
    setJobsToDelete([]);
  };

  const handleRetryConfirm = async (optionIds?: string[]) => {
    const deleteOriginal = optionIds?.includes("delete-original") ?? false;

    // Per-job retry. retryJob's return value of `false` opts the caller out of
    // the default retry — useful for knowledge sources which re-open the
    // trigger dialog instead of doing an in-place retry.
    let defaultRetryAccepted = true;
    for (const job of jobsToRetry) {
      const r = retryJob ? await retryJob(job) : undefined;
      if (r === false) defaultRetryAccepted = false;
    }

    if (deleteOriginal && defaultRetryAccepted) {
      try {
        await Promise.all(
          jobsToRetry
            .filter((j) => j.id)
            .map((j) =>
              deleteJob({ variables: { queue: queueName, id: j.id } }),
            ),
        );
      } catch {
        /* toast already surfaced by mutation onError */
      }
    }

    toast.success(
      jobsToRetry.length === 1 ? t("queueJobRetried") : t("queueJobsRetried"),
      { description: String(jobsToRetry.length) },
    );
    refetchJobs();
    refetchQueue();
    setSelectedJobs(new Set());
    setJobsToRetry([]);
  };

  /* ------- loading ------- */

  if (loadingQueue && loadingJobs) {
    const loader = (
      <div className="flex items-center justify-center py-8">
        <Loader2
          aria-hidden="true"
          className="size-6 animate-spin text-muted-foreground"
        />
      </div>
    );
    return embedded ? (
      loader
    ) : (
      <Card>
        <CardContent className="p-6">{loader}</CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn(embedded && "border-0 bg-transparent shadow-none")}>
        <CardHeader className={cn(embedded && "px-0 pb-0 pt-0")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {!embedded && (
              <div>
                <CardTitle className="text-base">
                  {t("queue")}: {label}
                </CardTitle>
                <CardDescription>{t("queueDescription")}</CardDescription>
              </div>
            )}
            {queue && canWrite ? (
              <div className={cn("flex flex-wrap gap-2", embedded && "md:ml-auto")}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 md:h-8"
                  onClick={() =>
                    queue.isPaused ? setResumeOpen(true) : setPauseOpen(true)
                  }
                >
                  {queue.isPaused ? (
                    <Play aria-hidden="true" className="mr-2 size-4" />
                  ) : (
                    <Pause aria-hidden="true" className="mr-2 size-4" />
                  )}
                  {queue.isPaused ? t("resumeQueue") : t("pauseQueue")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 md:h-8"
                  onClick={() => setDrainOpen(true)}
                >
                  <Droplet aria-hidden="true" className="mr-2 size-4" />
                  {t("drainQueue")}
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className={cn("flex flex-col gap-6", embedded && "px-0 pb-0 pt-4")}>
          {/* Queue health + tabs */}
          {queue ? (
            <div className="flex flex-col gap-4 rounded-lg bg-muted/50 p-4">
              <div className="flex flex-wrap items-center gap-4 md:gap-8">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("queueStatus")}:
                  </span>
                  {queue.isPaused ? (
                    <StatusBadge state="paused" />
                  ) : queue.isMaxed ? (
                    <StatusBadge state="failed" />
                  ) : (
                    <StatusBadge state="active" />
                  )}
                </div>
                <div className="hidden h-8 w-px bg-border md:block" />
                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                  <Meta
                    label={t("queueMaxConcurrency")}
                    value={queue.concurrency?.queue ?? t("none")}
                  />
                  <Meta
                    label={t("queueWorkerConcurrency")}
                    value={queue.concurrency?.worker ?? t("none")}
                  />
                  <Meta
                    label={t("queueTimeout")}
                    value={`${queue.timeoutInSeconds ?? t("none")}s`}
                  />
                </div>
                <div className="hidden h-8 w-px bg-border md:block" />
                <Meta
                  label={t("queueRateLimit")}
                  value={`${queue.ratelimit ?? t("none")}`}
                />
              </div>

              <div className="border-t pt-4">
                <Tabs
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as JobStatus);
                    setPage(1);
                    setSelectedJobs(new Set());
                  }}
                >
                  <TabsList className="flex-wrap">
                    {(
                      [
                        "active",
                        "waiting",
                        "failed",
                        "stuck",
                        "completed",
                      ] as const
                    ).map((s) => (
                      <TabsTrigger key={s} value={s} className="gap-1.5">
                        <span className="capitalize">{s}</span>
                        <Badge
                          variant="secondary"
                          className={cn("ml-1", STATUS_TOKEN[s])}
                        >
                          {queue.jobs?.[s] ?? 0}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("queueRetentionNote")}
                </p>
              </div>
            </div>
          ) : null}

          {/* Jobs */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{t("queueJobs")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("queueJobsDescription", { queue: label })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`queue-${queueName}-limit`}
                  className="text-sm text-muted-foreground"
                >
                  {t("show")}
                </Label>
                <Select
                  value={`${limit}`}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id={`queue-${queueName}-limit`}
                    className="h-11 w-[80px] md:h-8"
                  >
                    <SelectValue placeholder={limit} />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 50, 100, 200].map((n) => (
                      <SelectItem key={n} value={`${n}`}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canWrite && selectedJobs.size > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 md:h-8"
                      onClick={() =>
                        setJobsToRetry(
                          jobs.items.filter((j) => selectedJobs.has(j.id)),
                        )
                      }
                    >
                      <RefreshCcw aria-hidden="true" className="mr-2 size-4" />
                      {t("retry")} ({selectedJobs.size})
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-11 md:h-8"
                      onClick={() =>
                        setJobsToDelete(
                          jobs.items.filter((j) => selectedJobs.has(j.id)),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" className="mr-2 size-4" />
                      {t("delete")} ({selectedJobs.size})
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border">
              {loadingJobs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2
                    aria-hidden="true"
                    className="size-6 animate-spin text-muted-foreground"
                  />
                </div>
              ) : jobs.items.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("queueNoJobs")}
                </div>
              ) : isMobile ? (
                <JobCards
                  jobs={jobs.items}
                  resolveName={resolveName}
                  selectedJobs={selectedJobs}
                  toggleJob={toggleJob}
                  canWrite={canWrite}
                  onOpen={setDetailJob}
                  onDelete={(j) => setJobsToDelete([j])}
                  onRetry={(j) => setJobsToRetry([j])}
                />
              ) : (
                <JobTable
                  jobs={jobs.items}
                  resolveName={resolveName}
                  selectedJobs={selectedJobs}
                  toggleJob={toggleJob}
                  toggleAll={toggleAll}
                  canWrite={canWrite}
                  onOpen={setDetailJob}
                  onDelete={(j) => setJobsToDelete([j])}
                  onRetry={(j) => setJobsToRetry([j])}
                />
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between gap-4 px-2 pb-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  {jobs.pageInfo.itemCount} {t("totalItems")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden size-11 md:flex md:size-8"
                    onClick={() => setPage(1)}
                    disabled={!jobs.pageInfo.hasPreviousPage}
                  >
                    <span className="sr-only">{t("goToFirstPage")}</span>
                    <DoubleArrowLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 md:size-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!jobs.pageInfo.hasPreviousPage}
                  >
                    <span className="sr-only">{t("goToPreviousPage")}</span>
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 md:size-8"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!jobs.pageInfo.hasNextPage}
                  >
                    <span className="sr-only">{t("goToNextPage")}</span>
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pause */}
      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title={t("pauseQueueTitle")}
        description={t("pauseQueueDescription", { queue: label })}
        variant="default"
        confirmLabel={t("pauseQueue")}
        onConfirm={handlePauseConfirm}
      />
      {/* Resume */}
      <ConfirmDialog
        open={resumeOpen}
        onOpenChange={setResumeOpen}
        title={t("resumeQueueTitle")}
        description={t("resumeQueueDescription", { queue: label })}
        variant="default"
        confirmLabel={t("resumeQueue")}
        onConfirm={handleResumeConfirm}
      />
      {/* Drain */}
      <ConfirmDialog
        open={drainOpen}
        onOpenChange={setDrainOpen}
        title={t("drainQueueTitle")}
        description={t("drainQueueDescription", { queue: label })}
        confirmLabel={t("drainQueue")}
        onConfirm={handleDrainConfirm}
      />
      {/* Delete */}
      <ConfirmDialog
        open={jobsToDelete.length > 0}
        onOpenChange={(open) => !open && setJobsToDelete([])}
        title={
          jobsToDelete.length === 1
            ? t("deleteJobTitle")
            : t("deleteJobsTitle", { count: jobsToDelete.length })
        }
        description={
          jobsToDelete.length === 1
            ? t("deleteJobDescription", {
                name: jobsToDelete[0]
                  ? resolveName(jobsToDelete[0])
                  : "",
              })
            : t("deleteJobsDescription", { count: jobsToDelete.length })
        }
        onConfirm={handleDeleteConfirm}
      />
      {/* Retry */}
      <ConfirmDialog
        open={jobsToRetry.length > 0}
        onOpenChange={(open) => !open && setJobsToRetry([])}
        title={
          jobsToRetry.length === 1
            ? t("retryJobTitle")
            : t("retryJobsTitle", { count: jobsToRetry.length })
        }
        description={
          jobsToRetry.length === 1
            ? t("retryJobDescription")
            : t("retryJobsDescription", { count: jobsToRetry.length })
        }
        variant="default"
        confirmLabel={t("retry")}
        options={
          enableDeleteOriginalAfterRetry
            ? [
                {
                  id: "delete-original",
                  label:
                    jobsToRetry.length === 1
                      ? t("deleteOriginalJobAfterRetry")
                      : t("deleteOriginalJobsAfterRetry"),
                },
              ]
            : undefined
        }
        onConfirm={handleRetryConfirm}
      />

      {/* Failure-first job-detail drawer (F4). Opening a confirm from here
          would stack overlays, so the action handlers close the drawer first
          (state batches → confirm renders as the drawer unmounts). */}
      <JobDetailSheet
        job={detailJob}
        resolveName={resolveName}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setDetailJob(null);
        }}
        onRetry={(j) => {
          setDetailJob(null);
          setJobsToRetry([j]);
        }}
        onDelete={(j) => {
          setDetailJob(null);
          setJobsToDelete([j]);
        }}
      />
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function JobTable({
  jobs,
  resolveName,
  selectedJobs,
  toggleJob,
  toggleAll,
  canWrite,
  onOpen,
  onDelete,
  onRetry,
}: {
  jobs: QueuePanelJob[];
  resolveName: (j: QueuePanelJob) => string;
  selectedJobs: Set<string>;
  toggleJob: (id: string) => void;
  toggleAll: () => void;
  canWrite: boolean;
  onOpen: (j: QueuePanelJob) => void;
  onDelete: (j: QueuePanelJob) => void;
  onRetry: (j: QueuePanelJob) => void;
}) {
  const t = useTranslations("common");
  const selectable = jobs.filter((j) => j.state !== "active");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {canWrite ? (
            <TableHead className="w-12">
              <Checkbox
                checked={
                  selectable.length > 0 &&
                  selectedJobs.size === selectable.length
                }
                onCheckedChange={toggleAll}
                aria-label={t("selectAll")}
              />
            </TableHead>
          ) : null}
          <TableHead>{t("name")}</TableHead>
          <TableHead>{t("queueJobId")}</TableHead>
          <TableHead>{t("queueStatus")}</TableHead>
          <TableHead>{t("queueAttempts")}</TableHead>
          <TableHead>{t("queueCreated")}</TableHead>
          <TableHead>{t("queueFinished")}</TableHead>
          {canWrite ? (
            <TableHead className="text-right">{t("actions")}</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            {canWrite ? (
              <TableCell>
                <Checkbox
                  checked={selectedJobs.has(job.id)}
                  onCheckedChange={() => toggleJob(job.id)}
                  disabled={job.state === "active"}
                  aria-label={`${t("select")} ${resolveName(job)}`}
                />
              </TableCell>
            ) : null}
            <TableCell className="max-w-[220px] font-medium">
              <button
                type="button"
                onClick={() => onOpen(job)}
                className="block max-w-full truncate text-left hover:underline"
              >
                {resolveName(job)}
              </button>
            </TableCell>
            <TableCell className="max-w-[140px] truncate font-mono text-xs">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate">{job.id}</span>
                </TooltipTrigger>
                <TooltipContent>{job.id}</TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell>
              <StatusBadge state={job.state} />
            </TableCell>
            <TableCell>{job.attemptsMade ?? 0}</TableCell>
            <TableCell className="text-xs">
              {fmtTime(job.timestamp)}
            </TableCell>
            <TableCell className="text-xs">
              {fmtTime(job.finishedOn)}
            </TableCell>
            {canWrite ? (
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {job.state === "failed" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onRetry(job)}
                      aria-label={t("retry")}
                    >
                      <RefreshCcw
                        aria-hidden="true"
                        className="size-4 text-info"
                      />
                    </Button>
                  ) : null}
                  {job.state !== "active" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onDelete(job)}
                      aria-label={t("delete")}
                    >
                      <Trash2
                        aria-hidden="true"
                        className="size-4 text-destructive"
                      />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function JobCards({
  jobs,
  resolveName,
  selectedJobs,
  toggleJob,
  canWrite,
  onOpen,
  onDelete,
  onRetry,
}: {
  jobs: QueuePanelJob[];
  resolveName: (j: QueuePanelJob) => string;
  selectedJobs: Set<string>;
  toggleJob: (id: string) => void;
  canWrite: boolean;
  onOpen: (j: QueuePanelJob) => void;
  onDelete: (j: QueuePanelJob) => void;
  onRetry: (j: QueuePanelJob) => void;
}) {
  const t = useTranslations("common");
  return (
    <ul className="divide-y">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-start gap-3 p-3">
          {canWrite ? (
            <Checkbox
              checked={selectedJobs.has(job.id)}
              onCheckedChange={() => toggleJob(job.id)}
              disabled={job.state === "active"}
              aria-label={`${t("select")} ${resolveName(job)}`}
              className="mt-1"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onOpen(job)}
              className="block w-full text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">
                  {resolveName(job)}
                </p>
                <StatusBadge state={job.state} />
              </div>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {job.id}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("queueAttempts")}: {job.attemptsMade ?? 0} ·{" "}
                {fmtTime(job.finishedOn)}
              </p>
            </button>
            {canWrite ? (
              <div className="mt-2 flex gap-2">
                {job.state === "failed" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11"
                    onClick={() => onRetry(job)}
                  >
                    <RefreshCcw
                      aria-hidden="true"
                      className="mr-2 size-4"
                    />
                    {t("retry")}
                  </Button>
                ) : null}
                {job.state !== "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 text-destructive"
                    onClick={() => onDelete(job)}
                  >
                    <Trash2 aria-hidden="true" className="mr-2 size-4" />
                    {t("delete")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

function CodeBlock({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "destructive";
}) {
  return (
    <pre
      className={cn(
        "max-h-64 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed",
        tone === "destructive"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </pre>
  );
}

/** Failure-first job-detail drawer (knowledge V2 Phase F4). */
function JobDetailSheet({
  job,
  resolveName,
  canWrite,
  onOpenChange,
  onRetry,
  onDelete,
}: {
  job: QueuePanelJob | null;
  resolveName: (j: QueuePanelJob) => string;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (j: QueuePanelJob) => void;
  onDelete: (j: QueuePanelJob) => void;
}) {
  const t = useTranslations("common");
  if (!job) return null;

  const stack = Array.isArray(job.stacktrace)
    ? job.stacktrace.join("\n")
    : (job.stacktrace ?? "");
  const hasFailure = Boolean(job.failedReason || stack);
  const inputs =
    job.data == null ? "" : JSON.stringify(job.data, null, 2);

  return (
    <Sheet open={!!job} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="truncate font-mono text-base">
            {resolveName(job)}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
              {job.id}
              <CopyButton value={job.id} label={t("copyId")} size="icon" className="size-6" />
            </span>
            <StatusBadge state={job.state} />
            <Badge variant="outline" className="font-normal">
              {t("queueAttempts")}: {job.attemptsMade ?? 0}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {hasFailure && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-destructive">
                {t("queueFailure")}
              </h3>
              <CodeBlock tone="destructive">
                {job.failedReason ? `${job.failedReason}\n` : ""}
                {stack}
              </CodeBlock>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t("queueInputs")}</h3>
            {inputs ? (
              <CodeBlock>{inputs}</CodeBlock>
            ) : (
              <p className="text-sm text-muted-foreground">{t("queueNoInputs")}</p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 text-sm">
            <Meta label={t("queueStatus")} value={<StatusBadge state={job.state} />} />
            <Meta label={t("queueAttempts")} value={job.attemptsMade ?? 0} />
            <Meta label={t("queueCreated")} value={fmtTime(job.timestamp)} />
            <Meta label={t("queueFinished")} value={fmtTime(job.finishedOn)} />
          </section>
        </div>

        {canWrite && (job.state === "failed" || job.state !== "active") && (
          <div className="flex items-center justify-end gap-2 border-t p-4">
            {job.state === "failed" && (
              <Button type="button" onClick={() => onRetry(job)}>
                <RefreshCcw aria-hidden="true" className="mr-2 size-4" />
                {t("retry")}
              </Button>
            )}
            {job.state !== "active" && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => onDelete(job)}
              >
                <Trash2 aria-hidden="true" className="mr-2 size-4" />
                {t("delete")}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
