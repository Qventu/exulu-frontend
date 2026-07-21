"use client";

/**
 * RunsClient — the /runs page body: PageHeader + the shared RoutineRunsList
 * across all readable routines (routine column on, needs-attention lens on
 * by default — design §7.3).
 */

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/primitives/page-header";
import { PageShell } from "@/components/primitives/page-shell";
import { RoutineRunsList } from "@/components/widgets/routine-runs/runs-list";

export function RunsClient({ workflow }: { workflow?: string }) {
  const t = useTranslations("runs");

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
