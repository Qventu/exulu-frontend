"use client";

/**
 * useRunsAttentionCount — the sidebar's needs-attention badge feed
 * (email-routines design §7.3): polls routineRunsNeedingAttentionCount
 * every ~10 s, backing off to 60 s while the query errors (recovers on the
 * next success). Zero network unless the account can read workflows —
 * mirrors the Routines nav entry's gate exactly.
 *
 * Shell tier: lib + Apollo imports only (no app/*).
 */

import { useQuery } from "@apollo/client";
import * as React from "react";

import { can, type RightsUser } from "@/lib/rights";
import { ROUTINE_RUNS_ATTENTION_COUNT } from "@/lib/routine-runs/queries";

const BASE_POLL_MS = 10_000;
const ERROR_POLL_MS = 60_000;

export function useRunsAttentionCount(
  user: RightsUser | null | undefined,
): number {
  const [pollInterval, setPollInterval] = React.useState(BASE_POLL_MS);

  const enabled = !!user && can(user, { area: "workflows", level: "read" });

  const { data } = useQuery<{
    routineRunsNeedingAttentionCount?: number;
  }>(ROUTINE_RUNS_ATTENTION_COUNT, {
    skip: !enabled,
    pollInterval,
    fetchPolicy: "no-cache",
    onCompleted: () => setPollInterval(BASE_POLL_MS),
    onError: () => setPollInterval(ERROR_POLL_MS),
  });

  if (!enabled) return 0;
  const count = data?.routineRunsNeedingAttentionCount;
  return typeof count === "number" && count > 0 ? Math.round(count) : 0;
}
