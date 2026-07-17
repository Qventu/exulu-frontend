"use client";

/**
 * RunsClient — the /runs page body: PageHeader + the shared RoutineRunsList
 * across all readable routines (routine column on, needs-attention lens on
 * by default — design §7.3). Honest EmptyState while the backend flag is
 * off (the nav entry is hidden then; this covers direct URL hits).
 */

import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/primitives/empty-state";
import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RoutineRunsList } from "@/components/widgets/routine-runs/runs-list";
import { ROUTINES_RUNS_V2_SUPPORTED } from "@/lib/routine-runs/flags";

export function RunsClient({ workflow }: { workflow?: string }) {
  const t = useTranslations("runs");

  if (!ROUTINES_RUNS_V2_SUPPORTED) {
    return (
      <PageShell variant="content">
        <EmptyState
          variant="quiet"
          icon={Activity}
          title={t("unavailableTitle")}
          description={t("unavailableDescription")}
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="content">
      <PageHeader title={t("title")} description={t("description")} />
      <RoutineRunsList
        workflow={workflow}
        showRoutineColumn
        defaultNeedsAttention={!workflow}
      />
    </PageShell>
  );
}
