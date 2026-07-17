"use client";

/**
 * RunSessionBanner — slim banner above the conversation when the opened
 * session belongs to a routine run (email-routines design §7.4): routine
 * name, trigger, live run state, link back to the run (global /runs page,
 * pre-scoped to the routine). The approval card itself is the untouched
 * tool-call-approval.tsx; this banner only reflects the run's state — it
 * polls every 10 s while the run is non-terminal so a resolved approval
 * shows the resumed state without a manual refresh.
 *
 * Renders null unless ROUTINES_RUNS_V2_SUPPORTED and the session's Plan-1
 * metadata cross-link ({ routine_id, job_result_id, trigger }) is present —
 * mounting it unconditionally in SessionScreen is free today.
 *
 * Data via lib/routine-runs (chat may not import the workflows feature —
 * eslint feature isolation). Both lookups use errorPolicy "all": a caller
 * without routine read access simply gets no name / no run row, and the
 * banner degrades gracefully (fallback name) or hides (no run row).
 */

import { useQuery } from "@apollo/client";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTINES_RUNS_V2_SUPPORTED } from "@/lib/routine-runs/flags";
import {
  ALL_RUN_STATES,
  isTerminalRunState,
  RUN_STATE_BADGE,
  triggerBadge,
} from "@/lib/routine-runs/presentation";
import {
  ROUTINE_NAME_BY_ID,
  ROUTINE_RUN_FOR_SESSION,
} from "@/lib/routine-runs/queries";
import { cn } from "@/lib/utils";
import type { AgentSession } from "@/types/models/agent-session";

import { CHAT_COLUMN } from "./chat-shell";

/** Plan-1 session.metadata cross-link shape (design §3.4). */
interface RunLinkMetadata {
  routine_id?: string;
  job_result_id?: string;
  trigger?: string;
}

const POLL_MS = 10_000;

export function RunSessionBanner({ session }: { session: AgentSession }) {
  const t = useTranslations("chat.runBanner");
  const tState = useTranslations("routineRuns.state");
  const tTrigger = useTranslations("routineRuns.trigger");

  const meta = (session.metadata ?? null) as RunLinkMetadata | null;
  const jobResultId =
    typeof meta?.job_result_id === "string" && meta.job_result_id !== ""
      ? meta.job_result_id
      : null;
  const routineId =
    typeof meta?.routine_id === "string" && meta.routine_id !== ""
      ? meta.routine_id
      : null;
  const enabled = ROUTINES_RUNS_V2_SUPPORTED && jobResultId !== null;

  const { data, stopPolling } = useQuery<{
    job_resultById?: {
      id: string;
      state: string;
      trigger?: string | null;
      workflow?: string | null;
    } | null;
  }>(ROUTINE_RUN_FOR_SESSION, {
    variables: { id: jobResultId ?? "" },
    skip: !enabled,
    pollInterval: POLL_MS,
    fetchPolicy: "cache-and-network",
    errorPolicy: "all",
  });

  const run = data?.job_resultById ?? null;

  // Terminal runs never change again — stop the poller.
  React.useEffect(() => {
    if (run && isTerminalRunState(run.state)) stopPolling();
  }, [run, stopPolling]);

  const { data: routineData } = useQuery<{
    workflow_templateById?: { id: string; name?: string | null } | null;
  }>(ROUTINE_NAME_BY_ID, {
    variables: { id: routineId ?? "" },
    skip: !enabled || routineId === null,
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  });

  if (!enabled || !run) return null;

  const routineName =
    routineData?.workflow_templateById?.name ?? t("fallbackName");
  const badge = triggerBadge({
    trigger: typeof meta?.trigger === "string" ? meta.trigger : run.trigger,
    trigger_metadata: null,
  });
  const stateLabel = (ALL_RUN_STATES as readonly string[]).includes(run.state)
    ? tState(run.state)
    : run.state;
  const runsHref = run.workflow ? `/runs?workflow=${run.workflow}` : "/runs";

  return (
    <div className={cn(CHAT_COLUMN, "shrink-0 pt-2")}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <ListChecks
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 truncate">
          {t("label", { name: routineName })}
        </span>
        {badge.key !== "none" ? (
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {tTrigger(badge.key)}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={cn(RUN_STATE_BADGE[run.state] ?? "")}
        >
          {stateLabel}
        </Badge>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href={runsHref}>{t("viewRun")}</Link>
        </Button>
      </div>
    </div>
  );
}
