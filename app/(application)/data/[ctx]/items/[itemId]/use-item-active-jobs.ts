"use client";

/**
 * useItemActiveJobs — detects whether THIS item currently has in-flight
 * pipeline work, so the item page's stepper shows "running" on a fresh visit
 * (not only right after an action). Knowledge V2 KB-7.
 *
 * Backed by the durable job_results table: the queue decorator writes a
 * "waiting" row at ENQUEUE time (with indexed item + type columns), the
 * worker advances it to active, and the completed/failed handlers drive it to
 * a terminal state — all keyed by job_id. So one indexed query
 * (`state in [waiting, active, delayed]` for this item) catches queued jobs
 * too, and the running state survives a refresh until the job actually
 * finishes. No queue scanning, no scan-window limit.
 */

import { useQuery } from "@apollo/client";

import type { Context } from "@/types/models/context";

import { GET_ITEM_ACTIVE_JOBS } from "../../../queries";

const POLL_MS = 5000;
const NON_TERMINAL = ["waiting", "active", "delayed"];

interface ActiveJobsData {
  job_resultsPagination: { items: { id: string; type?: string | null; state?: string | null }[] };
}

export interface ItemActiveJobs {
  processorRunning: boolean;
  embedderRunning: boolean;
  refetch: () => void;
}

export function useItemActiveJobs(context: Context, itemId: string): ItemActiveJobs {
  // Only relevant when the context actually has a processor/embedder stage.
  const enabled = Boolean(itemId) && Boolean(context.processor || context.embedder);

  const { data, refetch } = useQuery<ActiveJobsData>(GET_ITEM_ACTIVE_JOBS, {
    skip: !enabled,
    fetchPolicy: "network-only",
    pollInterval: POLL_MS,
    // A query error (e.g. before the backend ships the item/type columns)
    // degrades to "no active jobs" rather than throwing.
    errorPolicy: "all",
    variables: { item: itemId, states: NON_TERMINAL },
  });

  const items = data?.job_resultsPagination?.items ?? [];

  return {
    processorRunning: items.some((j) => j.type === "processor"),
    embedderRunning: items.some((j) => j.type === "embedder"),
    refetch: () => {
      void refetch();
    },
  };
}
