"use client";

/**
 * EvalRuns — the Results tab body for a single eval set.
 *
 * Phase 5.1 redesign (design/pages/evals.md §5.1):
 * - Dropped the in-section Card-in-Card chrome. The parent page already owns
 *   a PageHeader with a primary "Run eval" button and a "New run config"
 *   overflow entry, so a second "+ New Eval Run" button in this section was
 *   pure duplication.
 * - Workers banner now goes through the shared <WorkersWarning /> primitive
 *   (orange variant; super-admin gets a Configuration link).
 * - Queue management migrated from a Collapsible-in-Card panel that
 *   dominated the page to a quiet inline <QueueChip /> placed above the
 *   matrix. The chip opens a right-side Sheet hosting the full
 *   <QueueManagement /> panel. Hidden entirely when the queue is empty.
 * - `canWrite` / `onSwitchToCasesTab` are accepted as optional props so the
 *   parent page can pass them through without forcing a synchronized
 *   landing of both files. When absent we derive `canWrite` from the user
 *   context (read-only fallback for readers).
 */

import { useContext, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { UserContext } from "@/app/(application)/authenticated";
import { ConfigContext } from "@/components/shell/config-context";
import { EmptyState } from "@/components/primitives/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_EVAL_RUNS, GET_EVAL_SET_BY_ID } from "@/queries/queries";
import type { EvalRun } from "@/types/models/eval-run";
import type { EvalSet } from "@/types/models/eval-set";

import { EvalsAccessDenied } from "../../_shared/access-denied";
import { WorkersWarning } from "../../_shared/workers-warning";
import { CreateEvalRunModal } from "./components/create-eval-run-modal";
import { EvalRunsTable } from "./components/eval-runs-table";
import { QueueChip } from "./components/queue-chip";

interface EvalRunsProps {
  id: string;
  /** Optional override; falls back to UserContext-derived value. */
  canWrite?: boolean;
  /** Wired from the parent page's Tabs state. */
  onSwitchToCasesTab?: () => void;
}

export default function EvalRuns({
  id,
  canWrite: canWriteProp,
  onSwitchToCasesTab,
}: EvalRunsProps) {
  const { user } = useContext(UserContext);
  const config = useContext(ConfigContext);
  const t = useTranslations("evals.runs");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const hasEvalsAccess =
    user.super_admin ||
    user.role?.evals === "read" ||
    user.role?.evals === "write";
  const canWriteFallback = user.super_admin || user.role?.evals === "write";
  const canWrite = canWriteProp ?? canWriteFallback;
  const workersConfigured = Boolean(
    config?.workers?.enabled && config?.workers?.redisHost,
  );

  const { loading: loadingEvalSet, data: evalSetData } = useQuery(
    GET_EVAL_SET_BY_ID,
    {
      variables: { id },
      skip: !id,
    },
  );

  const {
    loading: loadingRuns,
    data: runsData,
    refetch: refetchRuns,
  } = useQuery(GET_EVAL_RUNS, {
    variables: {
      page: 1,
      limit: 100,
      filters: [{ eval_set_id: { eq: id } }],
    },
    skip: !id,
    pollInterval: 10000,
  });

  // Imported via dynamic require pattern below to avoid forcing a top-level
  // useMutation when the component renders the access-denied branch.

  if (!hasEvalsAccess) {
    return <EvalsAccessDenied />;
  }

  if (loadingEvalSet) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const evalSet: EvalSet | null = evalSetData?.eval_setById ?? null;
  const evalRuns: EvalRun[] = runsData?.eval_runsPagination?.items || [];

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkersWarning />

      {/* Queue chip — quiet, hidden when the queue is empty. */}
      {workersConfigured && evalRuns.length > 0 ? (
        <div className="flex items-center justify-end">
          <QueueChip evalSetId={id} canWrite={canWrite} />
        </div>
      ) : null}

      {loadingRuns ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : evalRuns.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            canWrite && workersConfigured
              ? {
                  label: t("empty.action"),
                  onClick: () => setCreateModalOpen(true),
                }
              : undefined
          }
        />
      ) : evalSet ? (
        <EvalRunsTable
          evalRuns={evalRuns}
          evalSet={evalSet}
          canWrite={canWrite}
          onRefetch={refetchRuns}
          onSwitchToCasesTab={onSwitchToCasesTab}
        />
      ) : null}

      {/* When the runs list is non-empty but the user still wants a fresh
          run config, we keep an unobtrusive trigger near the top-right of
          the matrix — but only for writers with workers configured. The
          parent page's PageHeader is the primary entry point; this is the
          fallback for users who landed deep on the Results tab. */}
      {evalRuns.length > 0 && canWrite && workersConfigured ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-7 text-xs text-muted-foreground"
          >
            <Plus aria-hidden="true" className="mr-1 h-3 w-3" />
            {t("empty.action")}
          </Button>
        </div>
      ) : null}

      <CreateEvalRunModal
        modalKey={`create-eval-run-modal-${id}`}
        eval_set_id={id}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreateSuccess={() => {
          refetchRuns();
        }}
      />
    </div>
  );
}
