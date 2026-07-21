"use client";

/**
 * RunsSection — RoutineRunsList widget scoped to this routine (real
 * `workflow` column filter, trigger badges, needs-attention, cancel/retry/
 * open-session — email-routines design §7.2).
 *
 * Wrapper for the /workflows/[id] workbench: anchored <section> for
 * useScrollSpy and SectionNav's scrollIntoView+focus contract.
 */

import { useTranslations } from "next-intl";

import { DetailSection } from "@/components/primitives/detail-section";
import { RoutineRunsList } from "@/components/widgets/routine-runs/runs-list";

import type { Routine } from "../../types";

export interface RunsSectionProps {
  routine: Routine;
  /**
   * Kept for call-site compatibility with routine-workbench.tsx; the v2
   * RoutineRunsList manages its own retry flow via cancelRoutineRun /
   * retryRoutineRun mutations and does not use this callback.
   */
  onRetry?: (prefill: Record<string, string>) => void;
}

export function RunsSection({ routine }: RunsSectionProps) {
  const t = useTranslations("routines");
  return (
    <section id="runs" className="scroll-mt-20" tabIndex={-1}>
      <DetailSection title={t("runs.title")} defaultOpen={true}>
        <RoutineRunsList workflow={routine.id} />
      </DetailSection>
    </section>
  );
}
