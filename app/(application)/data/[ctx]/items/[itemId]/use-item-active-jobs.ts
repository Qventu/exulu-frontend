"use client";

/**
 * useItemActiveJobs — detects whether THIS item currently has in-flight
 * pipeline work, so the item page's stepper can show "running" on a fresh
 * visit (not only right after an action). Knowledge V2 F4 review follow-up.
 *
 * The queue knows job counts but not "jobs for item X" — so we scan the
 * relevant queues (the context's processor + embedder queues) for
 * waiting/active/delayed jobs and match each job's `data` to this item's id.
 * Job-data shape is inconsistent across stages (processor enqueues
 * `data.item = <id string>`; the embedder enqueues `data.item = <full item>`),
 * so the matcher accepts both.
 *
 * Limitation: we scan up to `SCAN_LIMIT` jobs per queue. In a very large
 * backlog an item's job could sit beyond that window and read "pending"
 * until it advances — acceptable for typical knowledge contexts. A precise
 * fix would need a backend "jobs for item" lookup (BullMQ has no native
 * data-field index, so even that would scan).
 */

import { useQuery } from "@apollo/client";

import type { Context } from "@/types/models/context";

import { GET_JOBS } from "../../../queries";

const SCAN_LIMIT = 200;
const POLL_MS = 5000;
const IN_FLIGHT_STATES = ["waiting", "active", "delayed"];

interface JobsData {
  jobs: { items: { id: string; data?: unknown }[] };
}

function jobItemId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = (data as { item?: unknown; itemId?: unknown }).item ??
    (data as { itemId?: unknown }).itemId;
  if (raw == null) return undefined;
  if (typeof raw === "object") {
    const obj = raw as { id?: unknown; _id?: unknown };
    const id = obj.id ?? obj._id;
    return id == null ? undefined : String(id);
  }
  return String(raw);
}

function matchesItem(data: JobsData | undefined, itemId: string): boolean {
  return (data?.jobs?.items ?? []).some((j) => jobItemId(j.data) === itemId);
}

export interface ItemActiveJobs {
  processorRunning: boolean;
  embedderRunning: boolean;
  refetch: () => void;
}

export function useItemActiveJobs(context: Context, itemId: string): ItemActiveJobs {
  const procQueue = context.processor?.queue;
  const embQueue = context.embedder?.queue;

  const proc = useQuery<JobsData>(GET_JOBS, {
    skip: !procQueue,
    fetchPolicy: "network-only",
    pollInterval: POLL_MS,
    variables: { queue: procQueue, statusses: IN_FLIGHT_STATES, page: 1, limit: SCAN_LIMIT },
  });
  const emb = useQuery<JobsData>(GET_JOBS, {
    skip: !embQueue,
    fetchPolicy: "network-only",
    pollInterval: POLL_MS,
    variables: { queue: embQueue, statusses: IN_FLIGHT_STATES, page: 1, limit: SCAN_LIMIT },
  });

  return {
    processorRunning: Boolean(procQueue) && matchesItem(proc.data, itemId),
    embedderRunning: Boolean(embQueue) && matchesItem(emb.data, itemId),
    refetch: () => {
      void proc.refetch();
      void emb.refetch();
    },
  };
}
