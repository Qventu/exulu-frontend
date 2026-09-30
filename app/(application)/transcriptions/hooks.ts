"use client";

/**
 * Data hooks for /transcriptions (codebase-structure §3.2: redesigned pages
 * never call useQuery inline; hooks own fetch policy and polling cadence).
 */
import { useQuery } from "@apollo/client";
import * as React from "react";

import {
  GET_MEETING_RECORDING_USAGE,
  GET_PICKER_AGENTS,
  GET_PROJECTS,
  GET_PROMPT_LIBRARY,
  GET_TRANSCRIPT_ITEM,
  GET_TRANSCRIPT_ITEMS,
  GET_TRANSCRIPTION_JOBS,
} from "./queries";
import {
  ACTIVE_STATUSES,
  mergeTranscriptRows,
  type Job,
  type ProjectOption,
  type TranscriptItem,
  type TranscriptItemDetail,
  type TranscriptRow,
} from "./types";

const POLL_INTERVAL_MS = 5000;

type JobsResult = {
  transcription_jobsPagination: {
    pageInfo?: { itemCount?: number | null } | null;
    items: Job[];
  };
};

export interface TranscriptsResult {
  rows: TranscriptRow[];
  /** Saved jobs that share a meeting_url with a currently-failed job — the
   *  input to findRecoveredJob. Empty unless something actually failed. */
  recoveredJobs: Job[];
  needsReviewCount: number;
  initialLoading: boolean;
  /** Set when the in-progress half failed; the ready half may still be fine. */
  jobsError?: Error;
  /** Set when the ready half failed; the in-progress half may still be fine. */
  itemsError?: Error;
  canLoadMore: boolean;
  loadMore: () => void;
  refetchAll: () => void;
}

const ITEMS_PAGE_SIZE = 50;

/**
 * The merged home data layer (codebase-structure §1.1): unions the
 * creator-only in-progress jobs with the RBAC'd saved-transcript items, so
 * Shared with me / search / filters come from the item's existing rights
 * instead of a new resolver. The 5s poll runs ONLY while a job is actually
 * being worked on (queued/transcribing) or a live recording is in progress
 * (recording) — page-doc ladder row 3 — instead of polling forever. Saved
 * transcripts don't change on their own, so the items query never polls.
 */
export function useTranscripts(search: string): TranscriptsResult {
  const active = useQuery<JobsResult>(GET_TRANSCRIPTION_JOBS, {
    variables: { filters: [{ status: { in: [...ACTIVE_STATUSES] } }] },
    fetchPolicy: "cache-and-network",
  });

  const [limit, setLimit] = React.useState(ITEMS_PAGE_SIZE);
  const items = useQuery<{
    transcriptions_itemsPagination: {
      pageInfo?: { itemCount?: number | null; hasNextPage?: boolean | null } | null;
      items: TranscriptItem[];
    };
  }>(GET_TRANSCRIPT_ITEMS, {
    variables: {
      page: 1,
      limit,
      filters: search
        ? [{ archived: { eq: false }, name: { contains: search } }]
        : [{ archived: { eq: false } }],
    },
    fetchPolicy: "cache-and-network",
  });

  const jobs = React.useMemo(
    () => active.data?.transcription_jobsPagination?.items ?? [],
    [active.data],
  );
  const transcripts = React.useMemo(
    () => items.data?.transcriptions_itemsPagination?.items ?? [],
    [items.data],
  );

  const rows = React.useMemo(
    () => mergeTranscriptRows(jobs, transcripts),
    [jobs, transcripts],
  );

  // Poll only while something is genuinely in motion — unchanged from the
  // previous hook (page-doc ladder row 3).
  const hasRunning = jobs.some(
    (job) =>
      job.status === "queued" ||
      job.status === "transcribing" ||
      job.status === "recording",
  );
  const { startPolling, stopPolling } = active;
  React.useEffect(() => {
    if (!hasRunning) return;
    startPolling(POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [hasRunning, startPolling, stopPolling]);

  // findRecoveredJob (the 2026-09-22 "4 recordings reported lost" incident)
  // links a failed meeting job to the retry that succeeded. Both are
  // creator-only job rows and only the creator sees the failed one, so the
  // lookup stays on the jobs side — one targeted query, and only when there
  // is actually a failed meeting job to explain.
  const failedMeetingUrls = React.useMemo(
    () =>
      jobs
        .filter((job) => job.status === "failed" && !!job.meeting_url)
        .map((job) => job.meeting_url as string),
    [jobs],
  );
  const recovered = useQuery<JobsResult>(GET_TRANSCRIPTION_JOBS, {
    skip: failedMeetingUrls.length === 0,
    variables: {
      filters: [{ status: { eq: "saved" }, meeting_url: { in: failedMeetingUrls } }],
    },
    fetchPolicy: "cache-and-network",
  });
  const recoveredJobs = React.useMemo(
    () => recovered.data?.transcription_jobsPagination?.items ?? [],
    [recovered.data],
  );

  const { refetch: refetchJobs } = active;
  const { refetch: refetchItems } = items;

  return {
    rows,
    recoveredJobs,
    needsReviewCount: rows.filter((row) => row.state === "needs_review").length,
    initialLoading:
      (active.loading && !active.data) || (items.loading && !items.data),
    jobsError: active.error as Error | undefined,
    itemsError: items.error as Error | undefined,
    canLoadMore:
      !!items.data?.transcriptions_itemsPagination?.pageInfo?.hasNextPage,
    loadMore: () => setLimit((current) => current + ITEMS_PAGE_SIZE),
    refetchAll: () => {
      void refetchJobs();
      void refetchItems();
    },
  };
}

/**
 * A single saved transcript for the reading view (task-10 brief, Step 9 —
 * page.tsx stays a thin fetch-and-render shell; hooks.ts owns fetch policy,
 * per the module docstring above).
 */
export function useTranscriptItem(itemId: string): {
  item: TranscriptItemDetail | null;
  loading: boolean;
  error?: Error;
  refetch: () => void;
} {
  const { data, loading, error, refetch } = useQuery<{
    transcriptions_itemsPagination: { items: TranscriptItemDetail[] };
  }>(GET_TRANSCRIPT_ITEM, {
    variables: { id: itemId },
    fetchPolicy: "cache-and-network",
    skip: !itemId,
  });
  return {
    item: data?.transcriptions_itemsPagination?.items?.[0] ?? null,
    loading: loading && !data,
    error: error as Error | undefined,
    refetch: () => void refetch(),
  };
}

type ProjectsResult = {
  projectsPagination: { items: ProjectOption[] };
};

export type RecordingUsage = {
  enabled: boolean;
  used_seconds: number;
  limit_seconds: number | null;
  percent: number | null;
  exceeded: boolean;
};

/**
 * Monthly meeting-recording usage against the optional cap. `enabled` is false
 * when no cap is configured (the bar is hidden in that case). Exposes refetch so
 * the page can refresh it after a new bot is started.
 */
export function useRecordingUsage(skip = false): {
  usage: RecordingUsage | null;
  refetch: () => void;
} {
  const { data, refetch } = useQuery<{
    meetingRecordingUsage: RecordingUsage | null;
  }>(GET_MEETING_RECORDING_USAGE, {
    skip,
    fetchPolicy: "cache-and-network",
  });
  return {
    usage: data?.meetingRecordingUsage ?? null,
    refetch: () => void refetch(),
  };
}

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

export type PromptOption = { id: string; name: string; description?: string | null };
export type AgentOption = { id: string; name: string };

/** Prompt-library + agent options for the post-processing picker (meeting and record composers). */
export function usePostProcessingOptions(): { prompts: PromptOption[]; agents: AgentOption[] } {
  const { data: promptsData } = useQuery<{ prompt_libraryPagination: { items: PromptOption[] } }>(
    GET_PROMPT_LIBRARY,
  );
  const { data: agentsData } = useQuery<{ agentsPagination: { items: AgentOption[] } }>(GET_PICKER_AGENTS);
  return {
    prompts: promptsData?.prompt_libraryPagination?.items ?? [],
    agents: agentsData?.agentsPagination?.items ?? [],
  };
}
