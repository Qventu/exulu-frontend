"use client";

/**
 * Data hooks for /transcriptions (codebase-structure §3.2: redesigned pages
 * never call useQuery inline; hooks own fetch policy and polling cadence).
 */
import { useMutation, useQuery } from "@apollo/client";
import * as React from "react";

import { ConfigContext } from "@/components/shell/config-context";
import { getToken } from "@/lib/api/client";

import {
  GET_MEETING_RECORDING_USAGE,
  GET_PICKER_AGENTS,
  GET_PROJECTS,
  GET_PROMPT_LIBRARY,
  GET_TRANSCRIPT_ITEM,
  GET_TRANSCRIPT_ITEMS,
  GET_TRANSCRIPTION_JOBS,
  GET_TRANSCRIPTS_SETTINGS,
  SET_TRANSCRIPTS_SETTINGS,
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

/* ----------------------- Transcripts settings (admin) ----------------------- */

export type SettingSource = "database" | "env" | "code";

export interface ResolvedSetting<T> {
  value: T;
  source: SettingSource;
}

export type SummaryPreset = { prompt_id: string; agent_id: string };

/** The two sentinel fields, parsed back from the wire string into the shape
 *  the settings page actually works with. */
export type RetentionHours = number | "forever";
export type RecordingLimitMinutes = number | "none";

/** Straight off the wire: videoRetentionHours/monthlyRecordingLimitMinutes
 *  are still raw strings here (see TRANSCRIPTS_SETTINGS_FIELDS in
 *  queries.ts) — parseSettings below turns this into TranscriptsSettings. */
interface TranscriptsSettingsWire {
  botName: ResolvedSetting<string | null>;
  notifyChat: ResolvedSetting<boolean | null>;
  recordersMayOverrideBot: ResolvedSetting<boolean | null>;
  defaultRightsMode: ResolvedSetting<string | null>;
  summaryPresets: ResolvedSetting<SummaryPreset[]>;
  videoRetentionHours: ResolvedSetting<string>;
  storeVideoLocally: ResolvedSetting<boolean | null>;
  monthlyRecordingLimitMinutes: ResolvedSetting<string>;
  videoStorageCostPerHour: ResolvedSetting<number | null>;
  stalePresets: SummaryPreset[];
}

export interface TranscriptsSettings {
  botName: ResolvedSetting<string | null>;
  notifyChat: ResolvedSetting<boolean | null>;
  recordersMayOverrideBot: ResolvedSetting<boolean | null>;
  defaultRightsMode: ResolvedSetting<string | null>;
  summaryPresets: ResolvedSetting<SummaryPreset[]>;
  videoRetentionHours: ResolvedSetting<RetentionHours>;
  storeVideoLocally: ResolvedSetting<boolean | null>;
  monthlyRecordingLimitMinutes: ResolvedSetting<RecordingLimitMinutes>;
  videoStorageCostPerHour: ResolvedSetting<number | null>;
}

/**
 * Only the fields a section actually edits belong in a patch. An omitted key
 * means "leave alone"; an explicit `null` means "clear back to the env/code
 * default" (settings design doc §1, §6). buildSettingsInput below is what
 * keeps that distinction alive on the wire — never spread a full
 * TranscriptsSettings object in here, or saving one section clears every
 * other section's stored value.
 */
export interface TranscriptsSettingsPatch {
  botName?: string | null;
  notifyChat?: boolean | null;
  recordersMayOverrideBot?: boolean | null;
  defaultRightsMode?: string | null;
  summaryPresets?: SummaryPreset[] | null;
  videoRetentionHours?: RetentionHours | null;
  storeVideoLocally?: boolean | null;
  monthlyRecordingLimitMinutes?: RecordingLimitMinutes | null;
  videoStorageCostPerHour?: number | null;
}

export type TranscriptionSource = "upload" | "meeting" | "record";

export type SourceTestResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "unreachable"; message: string };

/**
 * `String(value)` in reverse (buildTranscriptsSettingsInfo on the backend):
 * the sentinel string passes through verbatim, anything else becomes a
 * number. Getting this backwards is exactly what shows NaN, or the wrong
 * control state, for these two fields on the settings page.
 */
export function parseNumericOrSentinel<S extends string>(raw: string, sentinel: S): number | S {
  return raw === sentinel ? sentinel : Number(raw);
}

function parseSettings(wire: TranscriptsSettingsWire): TranscriptsSettings {
  return {
    botName: wire.botName,
    notifyChat: wire.notifyChat,
    recordersMayOverrideBot: wire.recordersMayOverrideBot,
    defaultRightsMode: wire.defaultRightsMode,
    summaryPresets: wire.summaryPresets,
    videoRetentionHours: {
      value: parseNumericOrSentinel(wire.videoRetentionHours.value, "forever"),
      source: wire.videoRetentionHours.source,
    },
    storeVideoLocally: wire.storeVideoLocally,
    monthlyRecordingLimitMinutes: {
      value: parseNumericOrSentinel(wire.monthlyRecordingLimitMinutes.value, "none"),
      source: wire.monthlyRecordingLimitMinutes.source,
    },
    videoStorageCostPerHour: wire.videoStorageCostPerHour,
  };
}

/** The inverse of parseNumericOrSentinel for the save path: a number becomes
 *  its decimal string, the sentinel passes through verbatim, and `null` /
 *  `undefined` pass through untouched so buildSettingsInput's
 *  omitted-vs-null distinction survives this step too. */
export function serializeNumericOrSentinel(
  value: number | string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) return value;
  return String(value);
}

/**
 * Only the keys present in `patch` reach the mutation variables — checked
 * with `in`, never `?.` or a default, so an explicit `null` (clear to
 * env/code) survives alongside a genuinely omitted key (leave alone).
 * Mirrors parseSettingsInput on the backend
 * (src/graphql/mutations/transcripts-settings-input.ts), in reverse.
 */
export function buildSettingsInput(patch: TranscriptsSettingsPatch): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if ("botName" in patch) input.botName = patch.botName;
  if ("notifyChat" in patch) input.notifyChat = patch.notifyChat;
  if ("recordersMayOverrideBot" in patch) {
    input.recordersMayOverrideBot = patch.recordersMayOverrideBot;
  }
  if ("defaultRightsMode" in patch) input.defaultRightsMode = patch.defaultRightsMode;
  if ("summaryPresets" in patch) input.summaryPresets = patch.summaryPresets;
  if ("videoRetentionHours" in patch) {
    input.videoRetentionHours = serializeNumericOrSentinel(patch.videoRetentionHours);
  }
  if ("storeVideoLocally" in patch) input.storeVideoLocally = patch.storeVideoLocally;
  if ("monthlyRecordingLimitMinutes" in patch) {
    input.monthlyRecordingLimitMinutes = serializeNumericOrSentinel(
      patch.monthlyRecordingLimitMinutes,
    );
  }
  if ("videoStorageCostPerHour" in patch) {
    input.videoStorageCostPerHour = patch.videoStorageCostPerHour;
  }
  return input;
}

/**
 * The meeting composer's seed for `notifyChat` (final fix wave, Fix 3).
 * `meeting-composer.tsx` hardcoded `React.useState(true)` and always sent an
 * explicit boolean, so the workspace setting was unreachable through the
 * product's own UI — but the resolved setting's own code-level fallback
 * (`resolveTranscriptsSettings`'s `resolveSetting(stored.notifyChat, null,
 * false)` in transcripts-settings.ts) is `false`, preserved there specifically
 * for API callers that bypass this composer and never send `notify_chat` at
 * all. Seeding straight off `setting.value` would silently flip the
 * composer's own 2026-09-22 default-ON decision (a bot sitting unannounced in
 * a waiting room is the leading cause of "bot finished without a recording")
 * for every deployment that has configured nothing.
 *
 * So only an admin's own stored choice (`source: "database"`) overrides the
 * ON default; `"env"` and `"code"` both mean "nothing configured here" and
 * keep the composer's long-standing default instead of adopting the
 * resolver's unrelated backward-compatibility fallback. `undefined` while the
 * settings round trip hasn't resolved yet, so use-seeded-value.ts knows to
 * keep waiting rather than seeding early.
 */
export function resolveNotifyChatSeed(
  setting: ResolvedSetting<boolean | null> | undefined,
): boolean | undefined {
  if (!setting) return undefined;
  return setting.source === "database" ? (setting.value ?? true) : true;
}

/** Best-effort `detail` extraction from a non-OK REST response body, for
 *  testSource's error message. */
function errorDetail(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
  }
  return `Test failed with status ${status}.`;
}

export interface TranscriptsSettingsResult {
  settings: TranscriptsSettings | null;
  stalePresets: SummaryPreset[];
  loading: boolean;
  error?: Error;
  /** Sends only the fields `patch` sets, and refetches on success so two
   *  admins saving concurrently both end up looking at the winner's values
   *  (design doc §6) — never a full object, or one section's save would
   *  wipe every other section's stored value. */
  save: (patch: TranscriptsSettingsPatch) => Promise<void>;
  /** `GET {backend}/transcription-sources/{source}/test`, header-authenticated
   *  exactly like the reading view's export route (export-menu.tsx's
   *  fetchExport) — never a bare navigation, which would hit a 401 since
   *  this route is super_admin-gated. */
  testSource: (source: TranscriptionSource) => Promise<SourceTestResult>;
}

/**
 * The admin settings page's one data source (task-6 brief): the single
 * workspace settings object plus the per-source liveness check. Fetch
 * policy and error surfacing follow useTranscripts above and
 * useEmbedderSettings (app/(application)/data/hooks.ts) — the existing
 * database -> env/code settings pattern this one generalises from.
 */
export function useTranscriptsSettings(): TranscriptsSettingsResult {
  const config = React.useContext(ConfigContext);
  const backend = config?.backend;

  const { data, loading, error, refetch } = useQuery<{
    transcriptsSettings: TranscriptsSettingsWire;
  }>(GET_TRANSCRIPTS_SETTINGS, { fetchPolicy: "cache-and-network" });

  const [mutate] = useMutation<{ setTranscriptsSettings: TranscriptsSettingsWire }>(
    SET_TRANSCRIPTS_SETTINGS,
  );

  const settings = React.useMemo(
    () => (data?.transcriptsSettings ? parseSettings(data.transcriptsSettings) : null),
    [data],
  );

  return {
    settings,
    stalePresets: data?.transcriptsSettings?.stalePresets ?? [],
    loading: loading && !data,
    error: error as Error | undefined,
    save: async (patch) => {
      await mutate({ variables: { input: buildSettingsInput(patch) } });
      await refetch();
    },
    testSource: async (source) => {
      if (!backend) {
        throw new Error("Backend is not configured.");
      }
      const token = await getToken();
      const res = await fetch(`${backend}/transcription-sources/${source}/test`, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorDetail(body, res.status));
      }
      return body as SourceTestResult;
    },
  };
}
