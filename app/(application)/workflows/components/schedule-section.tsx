"use client";

/**
 * ScheduleSection — DetailSection wrapping the per-routine cron schedule
 * (workflows.md ladder items 22, 23, 24, 25).
 *
 * Fetches GET_WORKFLOW_SCHEDULE once on mount (no poll). Hosts ScheduleEditor
 * for create/update. Remove goes through the shared ConfirmDialog. Refetches
 * the routines list on success.
 */

import { useMutation, useQuery } from "@apollo/client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/primitives/confirm-dialog";
import { DetailSection } from "@/components/primitives/detail-section";
import { RelativeTime } from "@/components/primitives/relative-time";
import { Button } from "@/components/ui/button";

import {
  DELETE_WORKFLOW_SCHEDULE,
  GET_WORKFLOW_SCHEDULE,
  GET_WORKFLOW_TEMPLATES,
  UPSERT_WORKFLOW_SCHEDULE,
} from "../queries";
import type { Routine, RoutineAccess } from "../types";
import { ScheduleEditor } from "./schedule-editor";

export interface ScheduleSectionProps {
  routine: Routine;
  access: RoutineAccess;
}

export function ScheduleSection({ routine, access }: ScheduleSectionProps) {
  const t = useTranslations("routines");

  const { data, loading, refetch } = useQuery<{
    workflowSchedule?: {
      schedule?: string | null;
      next?: string | null;
    } | null;
  }>(GET_WORKFLOW_SCHEDULE, {
    variables: { workflow: routine.id },
    fetchPolicy: "cache-and-network",
  });

  const [pendingCron, setPendingCron] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const [upsertMutate, upsertState] = useMutation(UPSERT_WORKFLOW_SCHEDULE, {
    refetchQueries: [
      { query: GET_WORKFLOW_SCHEDULE, variables: { workflow: routine.id } },
      GET_WORKFLOW_TEMPLATES,
      "GetWorkflowTemplates",
    ],
  });

  const [deleteMutate, deleteState] = useMutation(DELETE_WORKFLOW_SCHEDULE, {
    refetchQueries: [
      { query: GET_WORKFLOW_SCHEDULE, variables: { workflow: routine.id } },
      GET_WORKFLOW_TEMPLATES,
      "GetWorkflowTemplates",
    ],
  });

  const current = data?.workflowSchedule;
  const currentCron = current?.schedule ?? undefined;

  const handleSave = async () => {
    if (!pendingCron) {
      toast.error(t("schedule.toast.invalidCron"));
      return;
    }
    try {
      await upsertMutate({
        variables: { workflow: routine.id, schedule: pendingCron },
      });
      toast.success(t("schedule.toast.saved"));
      setPendingCron(null);
      await refetch();
    } catch (err) {
      toast.error(t("schedule.toast.saveFailed"), {
        description: (err as Error).message,
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteMutate({ variables: { workflow: routine.id } });
      toast.success(t("schedule.toast.deleted"));
      await refetch();
    } catch (err) {
      toast.error(t("schedule.toast.deleteFailed"), {
        description: (err as Error).message,
      });
      throw err; // keep ConfirmDialog open
    }
  };

  return (
    <DetailSection
      title={t("schedule.title")}
      defaultOpen={false}
      meta={
        currentCron ? (
          <code className="font-mono text-xs">{currentCron}</code>
        ) : (
          t("schedule.none")
        )
      }
    >
      <div className="space-y-3">
        {loading && !current ? (
          <p className="text-sm text-muted-foreground">{t("schedule.loading")}</p>
        ) : null}

        {current?.next ? (
          <p className="text-xs text-muted-foreground">
            {t("schedule.nextRun")} <RelativeTime date={current.next} />
          </p>
        ) : null}

        <ScheduleEditor
          value={currentCron}
          onChange={setPendingCron}
          disabled={!access.canWrite || upsertState.loading || deleteState.loading}
        />

        {access.canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              disabled={!pendingCron || pendingCron === currentCron || upsertState.loading}
            >
              {upsertState.loading
                ? t("schedule.saving")
                : currentCron
                  ? t("schedule.update")
                  : t("schedule.save")}
            </Button>
            {currentCron ? (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteState.loading}
              >
                <Trash2 aria-hidden="true" className="mr-2 size-4" />
                {t("schedule.remove")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("schedule.delete.title")}
        description={t("schedule.delete.description", { name: routine.name })}
        variant="destructive"
        onConfirm={handleConfirmDelete}
        confirmLabel={t("schedule.delete.confirmLabel")}
      />
    </DetailSection>
  );
}
