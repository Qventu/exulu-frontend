"use client";

/**
 * QueueChip — quiet inline status chip that summarizes the eval-runs queue
 * ("Queue: N active · M failed") and, on click, opens a right-side Sheet
 * hosting the full <QueueManagement /> panel.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1): the old experience nested
 * the entire queue panel inside a Collapsible-in-Card block in the runs page,
 * dominating the matrix view. The chip replaces that with a low-noise status
 * affordance — hidden entirely when there are no jobs in any state, and
 * still operable by readers (open & inspect) while the underlying panel
 * gates destructive actions behind `canWrite` (see queue-management.tsx).
 */

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GET_QUEUE, RUN_EVAL } from "@/queries/queries";
import type { QueueJob } from "@/types/models/job";

import { QueueManagement } from "./queue-management";

export interface QueueChipProps {
  evalSetId: string;
  canWrite: boolean;
  className?: string;
}

const QUEUE_NAME = "eval_runs";

export function QueueChip({ evalSetId: _evalSetId, canWrite, className }: QueueChipProps) {
  const t = useTranslations("evals.queue");
  const tErrors = useTranslations("evals.queue.retryJobsError");
  const [open, setOpen] = useState(false);

  const { data } = useQuery(GET_QUEUE, {
    variables: { queue: QUEUE_NAME },
    pollInterval: 5000,
  });

  const [runEval] = useMutation(RUN_EVAL, {
    onError: (error) => {
      toast.error(t("retryJobsError.missingData"), { description: error.message });
    },
  });

  const queue = data?.queue;
  if (!queue) return null;

  const jobs = queue.jobs ?? {};
  const active = jobs.active ?? 0;
  const waiting = jobs.waiting ?? 0;
  const failed = jobs.failed ?? 0;
  const delayed = jobs.delayed ?? 0;
  const paused = jobs.paused ?? 0;
  const total = active + waiting + failed + delayed + paused;

  // Hide entirely when the queue has nothing notable to surface.
  if (total === 0) return null;

  // Retry handler mirrors the original page-level wiring: reschedule a single
  // test case under the same eval run by calling the RUN_EVAL mutation.
  const retryJob = (job: QueueJob) => {
    const testCaseId = job.data?.test_case_id;
    const evalRunId = job.data?.eval_run_id;
    if (!testCaseId || !evalRunId) {
      toast.error(tErrors("missingData"));
      return;
    }
    runEval({
      variables: { id: evalRunId, test_case_ids: [testCaseId] },
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("chip.open")}
        className={cn("h-7 gap-1.5 px-2 text-xs text-muted-foreground", className)}
      >
        <span className="font-medium text-foreground">{t("chip.label")}</span>
        <span>{t("chip.active", { count: active })}</span>
        <span aria-hidden="true">·</span>
        <span className={cn(failed > 0 && "text-destructive")}>
          {t("chip.failed", { count: failed })}
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-3xl"
        >
          <SheetHeader className="border-b p-6">
            <SheetTitle>{t("panel.title", { queueName: QUEUE_NAME })}</SheetTitle>
          </SheetHeader>
          <div className="p-6">
            <QueueManagement
              queueName={QUEUE_NAME}
              canWrite={canWrite}
              nameGenerator={(job) =>
                `Eval Run ${job.data?.eval_run_name || job.data?.eval_run_id} · Test Case ${job.data?.test_case_name || job.data?.test_case_id}`
              }
              retryJob={retryJob}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
