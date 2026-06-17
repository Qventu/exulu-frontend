"use client";

/**
 * Data hooks for /transcriptions (codebase-structure §3.2: redesigned pages
 * never call useQuery inline; hooks own fetch policy and polling cadence).
 */
import { useQuery } from "@apollo/client";
import * as React from "react";

import { GET_PROJECTS, GET_TRANSCRIPTION_JOBS } from "./queries";
import { ACTIVE_STATUSES, type Job, type ProjectOption } from "./types";

const POLL_INTERVAL_MS = 5000;
const SAVED_PAGE_SIZE = 50;

type JobsResult = {
  transcription_jobsPagination: {
    pageInfo?: { itemCount?: number | null } | null;
    items: Job[];
  };
};

export interface TranscriptionJobs {
  /** queued | transcribing | awaiting_review | failed */
  activeJobs: Job[];
  savedJobs: Job[];
  savedTotal: number;
  /** True while either list is loading with no data yet. */
  initialLoading: boolean;
  /** "Load more" for the saved list past the first 50 (page-doc ladder #4). */
  canLoadMoreSaved: boolean;
  loadMoreSaved: () => void;
  refetchAll: () => void;
}

/**
 * Both list queries. The 5s poll runs ONLY while a job is actually being
 * worked on (queued/transcribing) — page-doc ladder row 3 — instead of
 * polling forever.
 */
export function useTranscriptionJobs(): TranscriptionJobs {
  const active = useQuery<JobsResult>(GET_TRANSCRIPTION_JOBS, {
    variables: {
      filters: [{ status: { in: [...ACTIVE_STATUSES] } }],
    },
    fetchPolicy: "cache-and-network",
  });

  const [savedLimit, setSavedLimit] = React.useState(SAVED_PAGE_SIZE);
  const saved = useQuery<JobsResult>(GET_TRANSCRIPTION_JOBS, {
    variables: {
      filters: [{ status: { eq: "saved" } }],
      limit: savedLimit,
    },
    fetchPolicy: "cache-and-network",
  });

  const activeJobs = React.useMemo(
    () => active.data?.transcription_jobsPagination?.items ?? [],
    [active.data],
  );
  const savedJobs = React.useMemo(
    () => saved.data?.transcription_jobsPagination?.items ?? [],
    [saved.data],
  );
  const savedTotal =
    saved.data?.transcription_jobsPagination?.pageInfo?.itemCount ??
    savedJobs.length;

  const hasRunning = activeJobs.some(
    (job) => job.status === "queued" || job.status === "transcribing",
  );

  const { startPolling, stopPolling } = active;
  React.useEffect(() => {
    if (!hasRunning) return;
    startPolling(POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [hasRunning, startPolling, stopPolling]);

  const { refetch: refetchActive } = active;
  const { refetch: refetchSaved } = saved;
  const refetchAll = React.useCallback(() => {
    void refetchActive();
    void refetchSaved();
  }, [refetchActive, refetchSaved]);

  return {
    activeJobs,
    savedJobs,
    savedTotal,
    initialLoading:
      (active.loading && !active.data) || (saved.loading && !saved.data),
    canLoadMoreSaved: savedJobs.length < savedTotal,
    loadMoreSaved: () => setSavedLimit((limit) => limit + SAVED_PAGE_SIZE),
    refetchAll,
  };
}

type ProjectsResult = {
  projectsPagination: { items: ProjectOption[] };
};

/** First 100 projects for the optional project assignment (unchanged). */
export function useProjectOptions(): ProjectOption[] {
  const { data } = useQuery<ProjectsResult>(GET_PROJECTS, {
    variables: { page: 1, limit: 100 },
  });
  return data?.projectsPagination?.items ?? [];
}

/**
 * 1-second ticker scoped to the component that needs a live counter
 * (transcribing rows) — replaces the old whole-page tick re-render.
 * Returns the current timestamp; when disabled it stays at the mount time.
 */
export function useTicker(enabled: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}
