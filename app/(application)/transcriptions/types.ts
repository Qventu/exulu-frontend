/**
 * Feature types + pure helpers for /transcriptions
 * (codebase-structure §1.1 feature module shape).
 */

export type Mode = "private" | "users" | "roles" | "teams" | "public";

/**
 * The composer's seeded `defaultRightsMode` from the workspace setting (final
 * fix wave, Fix 1 — the admin "Default sharing" control in
 * settings/defaults-section.tsx was stored and resolved but read by nothing).
 * `undefined` while the settings round trip hasn't resolved yet, so the
 * caller (use-seeded-value.ts) knows to keep waiting rather than seeding a
 * composer with it; once resolved, a value outside that composer's own
 * `ALLOWED_MODES` (e.g. a workspace default a given composer doesn't offer)
 * falls back to "private" rather than handing a Select a value it has no
 * option for.
 */
export function sanitizeRightsMode(
  value: string | null | undefined,
  allowedModes: readonly Mode[],
): Mode | undefined {
  if (value === undefined) return undefined;
  return allowedModes.includes(value as Mode) ? (value as Mode) : "private";
}

export type JobStatus =
  | "queued"
  | "transcribing"
  | "recording" // live browser recording in progress
  | "awaiting_review"
  | "reviewed" // signed off by a human but deliberately not in the knowledge base
  | "saved"
  | "failed"
  | "cancelled";

export type RbacUser = { id: number; rights: "read" | "write" };
export type RbacRole = { id: string; rights: "read" | "write" };

/**
 * What a composer's primary action currently looks like, reported up to
 * `NewTranscriptDialog` (Task 9) so its shared footer can render the right
 * label/disabled/busy state and trigger the composer's own start logic
 * without the dialog needing to know how each composer validates itself.
 */
export interface ComposerPrimaryAction {
  label: string;
  disabled: boolean;
  busy: boolean;
  run: () => void;
}

/** Where a job came from: on-server Whisper upload, a Recall meeting bot, or a live browser recording. */
export type JobSource = "whisper" | "recall" | "live";

/** A selected post-processing pair (prompt from the library + chosen agent). */
export type PostProcessingPrompt = { prompt_id: string; agent_id: string };

/** A post-processing result stored on the job/transcript record. */
export type PostProcessingOutput = {
  prompt_id: string;
  agent_id: string;
  prompt_name: string | null;
  status: "done" | "failed";
  output: string | null;
  error: string | null;
  ran_at: string;
};

export type Job = {
  id: string;
  audio_s3key: string;
  title: string | null;
  status: JobStatus;
  whisper_job_id: string | null;
  language: string | null;
  duration_seconds: number | null;
  speakers: Record<string, string> | string | null;
  project_id: string | null;
  target_rights_mode: Mode | null;
  target_rbac_users: RbacUser[] | null;
  target_rbac_roles: RbacRole[] | null;
  saved_item_id: string | null;
  error: string | null;
  rights_mode: Mode;
  created_by: number;
  createdAt: string;
  updatedAt: string;
  // Recall meeting-bot fields (null/"whisper" for upload jobs).
  source?: JobSource | null;
  meeting_url?: string | null;
  recall_bot_id?: string | null;
  recall_recording_id?: string | null;
  bot_status?: string | null;
  join_at?: string | null;
  post_processing_prompts?: PostProcessingPrompt[] | string | null;
  post_processing_outputs?: PostProcessingOutput[] | string | null;
  // Permanent local copy of the meeting video (only when the deployment has
  // RECALL_STORE_VIDEO_LOCALLY on). Null falls back to an on-demand Recall URL.
  video_s3key?: string | null;
  // Live recordings: next expected chunk seq + heartbeat of the last accepted chunk.
  chunk_count?: number | null;
  last_chunk_at?: string | null;
};

export type Segment = {
  start: number;
  end: number;
  text: string;
  speaker: string;
};

export type ProjectOption = { id: string; name: string };

/** Statuses the "active" list query asks for (unchanged backend contract). */
export const ACTIVE_STATUSES = [
  "queued",
  "transcribing",
  "recording",
  "awaiting_review",
  "failed",
] as const;

/** Audio types accepted by the whisper pipeline (unchanged). */
export const AUDIO_FILE_TYPES = [
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mpeg",
] as const;

/**
 * Rough multiplier for processing time vs. realtime audio length, used for the
 * "~X remaining" estimate. WhisperX `large-v3` with diarization on:
 *   - CUDA consumer GPU: ~0.5–2× realtime
 *   - Mac CPU/MPS: ~8–12× slower than realtime
 * The default of 2 assumes a GPU-backed deployment; CPU-bound servers should
 * tune NEXT_PUBLIC_TRANSCRIPTION_FACTOR upward (e.g. 10) so the estimate
 * doesn't sit on "wrapping up" for hours. The label always keeps the "~" and
 * falls back to "wrapping up" when the estimate is exceeded.
 */
export const PROCESSING_FACTOR = Number(
  process.env.NEXT_PUBLIC_TRANSCRIPTION_FACTOR ?? "2",
);

/** Parse the persisted speakers map (JSON string or object). */
export function parseSpeakers(raw: Job["speakers"]): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

/** Parse raw_segments (JSON string or array) tolerantly. */
export function parseSegments(raw: unknown): Segment[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return raw as Segment[];
}

/**
 * The segments a reader/editor should actually see: a correction, once made,
 * wholly replaces the raw engine output (mirrors the backend's
 * `effectiveSegments` in transcript-text.ts — `corrected ?? raw ?? []`).
 * `corrected` is `!= null` here (not truthy), same reason: an explicit but
 * empty correction is still a correction, distinct from "never corrected."
 */
export function effectiveSegments(
  rawSegments: Segment[] | string | null | undefined,
  correctedSegments: Segment[] | string | null | undefined,
): Segment[] {
  return parseSegments(
    correctedSegments != null ? correctedSegments : rawSegments,
  );
}

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bulk correction across the transcript. Only `text` changes — start, end
 * and speaker are preserved, which is what makes "Timestamps stay in place"
 * true and lets the audio ribbon keep working after a replace.
 *
 * The needle is escaped: a user typing "(1)" means those three characters,
 * not a capture group.
 */
export function applyFindReplace(
  segments: Segment[],
  find: string,
  replace: string,
  matchCase: boolean,
): { segments: Segment[]; count: number } {
  if (!find) return { segments, count: 0 };
  const pattern = new RegExp(escapeRegExp(find), matchCase ? "g" : "gi");
  let count = 0;
  const next = segments.map((segment) => {
    const hits = segment.text.match(pattern);
    if (!hits) return segment;
    count += hits.length;
    return { ...segment, text: segment.text.replace(pattern, replace) };
  });
  return { segments: next, count };
}

/** Human filename from the `_EXULU_` S3-key convention. */
export function decodeFilename(s3Key: string): string {
  const last = s3Key.split("/").pop() ?? s3Key;
  return last.includes("_EXULU_") ? (last.split("_EXULU_").pop() ?? last) : last;
}

/** Row display name: title, falling back to the decoded filename / meeting URL. */
export function displayTitle(
  job: Pick<Job, "title" | "audio_s3key"> &
    Partial<Pick<Job, "source" | "meeting_url">>,
): string {
  if (job.title) return job.title;
  if (job.audio_s3key) return decodeFilename(job.audio_s3key);
  if (job.source === "live") return "Live recording";
  if (job.meeting_url) return job.meeting_url;
  return "Meeting recording";
}

/** True when the job is a Recall meeting-bot recording (vs a Whisper upload). */
export function isMeetingJob(job: Pick<Job, "source">): boolean {
  return job.source === "recall";
}

/** True when the job is a live browser recording ("Record on this device"). */
export function isLiveJob(job: Pick<Job, "source">): boolean {
  return job.source === "live";
}

/** Post-processing cards are shown for any job that has prompts configured or outputs stored. */
export function hasPostProcessing(
  job: Pick<Job, "post_processing_prompts" | "post_processing_outputs">,
): boolean {
  return (
    parsePostProcessingPrompts(job.post_processing_prompts).length > 0 ||
    parsePostProcessingOutputs(job.post_processing_outputs).length > 0
  );
}

/** Parse post_processing_prompts (JSON string or array) tolerantly. */
export function parsePostProcessingPrompts(
  raw: Job["post_processing_prompts"],
): PostProcessingPrompt[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PostProcessingPrompt[];
    } catch {
      return [];
    }
  }
  return raw;
}

/** Parse post_processing_outputs (JSON string or array) tolerantly. */
export function parsePostProcessingOutputs(
  raw: Job["post_processing_outputs"],
): PostProcessingOutput[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PostProcessingOutput[];
    } catch {
      return [];
    }
  }
  return raw;
}

/**
 * For a failed meeting-bot job, find the later "saved" job for the same
 * meeting_url — i.e. a retry that succeeded. The failed row otherwise lingers
 * forever with nothing in the UI showing its content already exists elsewhere
 * (2026-09-22 incident: a customer reported 4 "failed" recordings as lost; 3
 * had actually succeeded on retry and were already in "Saved"). Picks the
 * earliest save after the failure, not a later, unrelated reuse of the same
 * link by a recurring meeting.
 */
export function findRecoveredJob(failedJob: Job, savedJobs: Job[]): Job | null {
  if (!failedJob.meeting_url) return null;
  const failedTime = new Date(failedJob.createdAt).getTime();
  const candidates = savedJobs
    .filter(
      (saved) =>
        saved.meeting_url === failedJob.meeting_url &&
        new Date(saved.createdAt).getTime() > failedTime,
    )
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  return candidates[0] ?? null;
}

/**
 * Humanize a Recall bot lifecycle code (e.g. "in_call_recording") into a short
 * status line. Falls back to a title-cased version of the code.
 */
export function humanizeBotStatus(code: string | null | undefined): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    joining_call: "Joining the call…",
    in_waiting_room: "Waiting to be admitted…",
    in_call_not_recording: "In the call…",
    in_call_recording: "In the call — recording",
    recording_permission_allowed: "Recording allowed",
    call_ended: "Call ended",
    done: "Recording finished",
    fatal: "Bot failed to join",
  };
  return (
    map[code] ??
    code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

/** "1h 2m 10s" — numeric duration format (unit letters, not prose). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

/** "m:ss" clock timestamp for segment times. */
export function formatClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Deterministic speaker color from the chart token scale (design-system R1:
 * token-only colors) so SPEAKER_00 keeps its hue across renames and themes.
 */
const SPEAKER_TOKEN_COUNT = 8;

export function speakerColor(rawLabel: string): string {
  let hash = 0;
  for (let i = 0; i < rawLabel.length; i++) {
    hash = (hash * 31 + rawLabel.charCodeAt(i)) | 0;
  }
  const index = (Math.abs(hash) % SPEAKER_TOKEN_COUNT) + 1;
  return `hsl(var(--chart-${index}))`;
}

/** A saved transcript as it comes back from transcriptions_itemsPagination. */
export type TranscriptItem = {
  id: string;
  name: string | null;
  recording_source: JobSource | null;
  job_id: string | null;
  recorded_at: string | null;
  duration_seconds: number | null;
  speaker_count: number | null;
  project_id: string | null;
  rights_mode: Mode | null;
  created_by: number | null;
  post_processing: PostProcessingOutput[] | string | null;
};

/** Generic RBAC shape returned under `RBAC { type users { id rights } roles { id rights } }`. */
export type ItemRBAC = { type?: Mode; users: RbacUser[]; roles: RbacRole[] };

/**
 * A saved transcript's full detail — `GET_TRANSCRIPT_ITEM`'s selection set
 * exactly (task-10 brief, Interfaces block; Ruling 3). Extends `TranscriptItem`
 * (the home list's slimmer shape) with the fields only the reading view needs.
 *
 * `corrected_segments` and `updatedAt` are added by task-12: the column
 * exists now (the generic item-update mutation can write it, gated by
 * `validateWriteAccess`), and `updatedAt` backs the conflict guard on the
 * edit page (refetch on focus, warn before saving over someone else's change).
 */
export type TranscriptItemDetail = TranscriptItem & {
  transcript_text: string | null;
  raw_segments: Segment[] | string | null;
  corrected_segments: Segment[] | string | null;
  speakers: Record<string, string> | string | null;
  language: string | null;
  audio_s3key: string | null;
  video_s3key: string | null;
  recall_recording_id: string | null;
  RBAC: ItemRBAC | null;
  updatedAt: string;
};

/**
 * The current viewer, as much of it as write-access derivation needs. Kept
 * local to this feature (rather than importing `types/models/user`'s `User`)
 * because `role`/`team` arrive in two shapes at runtime — an unhydrated id
 * string, or the hydrated object `auth.ts` attaches when the role/team still
 * exists — and callers here don't want to fight a narrower type over it.
 */
export type CurrentUser = {
  id: number;
  role?: string | { id: string } | null;
  team?: string | { id: string } | null;
  super_admin?: boolean;
  type?: "api" | "user" | "external";
  scope_mode?: string | null;
};

/**
 * Whether `user` is this record's creator, or a super-admin who bypasses
 * ownership checks entirely. Factored out of `canWriteTranscriptItem` below
 * (its first two true-returning branches) so a caller that only needs "is
 * this mine" — e.g. deciding whether a saved transcript's edit should route
 * through `FINALIZE_TRANSCRIPTION_JOB`, which `assertOwnsTranscriptionJob`
 * gates server-side to the job's owner, a strictly narrower question than
 * "can I write this item" — reuses this instead of writing a third copy of
 * the same `String(...) === String(...)` comparison.
 */
export function isTranscriptItemOwner(
  item: Pick<TranscriptItemDetail, "created_by">,
  user: CurrentUser | null | undefined,
): boolean {
  if (!user) return false;
  if (user.super_admin === true) return true;
  return item.created_by != null && String(item.created_by) === String(user.id);
}

/**
 * Client-side mirror of the backend's `validateWriteAccess` (the same gate
 * `transcriptions_itemsUpdateOneById` runs server-side) — see
 * `src/graphql/mutations/index.ts` `createMutations.validateWriteAccess` and
 * `src/utils/check-item-write-access.ts`. `use-item-editor.ts` (the pattern
 * this was asked to reuse) does not itself derive write access — it renders
 * Edit unconditionally and relies entirely on the server rejecting the
 * mutation — which is too late for this task: a read-only viewer must never
 * see a Save button that's guaranteed to fail. This walks the exact same
 * rules using the RBAC data already on `TranscriptItemDetail` (super_admin /
 * admin-mode API keys aren't reachable from a browser session and are kept
 * only for parity with the server check). `teams` is deliberately not
 * evaluated: this feature's own RBAC UI doesn't surface team grants yet
 * (composer.tsx), so there is no team data here to check against — treated
 * as not-writable rather than guessed true.
 */
export function canWriteTranscriptItem(
  item: Pick<TranscriptItemDetail, "rights_mode" | "created_by" | "RBAC">,
  user: CurrentUser | null | undefined,
): boolean {
  if (!user) return false;
  // The creator can always edit their own record, whatever rights_mode it's
  // shared under (matches the server: sharing your own record via RBAC must
  // not lock you out of it) — and super_admin bypasses everything.
  if (isTranscriptItemOwner(item, user)) return true;
  if (user.type === "api" && (!user.scope_mode || user.scope_mode === "admin")) {
    return true;
  }

  const mode = item.rights_mode ?? "private";
  if (mode === "public") return true;
  if (mode === "private") return false;

  if (mode === "users") {
    return (item.RBAC?.users ?? []).some(
      (grant) => String(grant.id) === String(user.id) && grant.rights === "write",
    );
  }
  if (mode === "roles") {
    const roleId = typeof user.role === "string" ? user.role : user.role?.id;
    if (!roleId) return false;
    return (item.RBAC?.roles ?? []).some(
      (grant) => String(grant.id) === String(roleId) && grant.rights === "write",
    );
  }
  return false;
}

/**
 * Routing decision for `/transcriptions/[itemId]`'s save handler (task-13
 * fix): a saved transcript's `transcript_text` — what agent retrieval and
 * `/data` actually read — is only re-rendered by `transcriptionJobFinalize`,
 * not by the generic item-update mutation, which writes `corrected_segments`
 * alone. So a correction should route through finalize whenever there's a
 * job behind this item AND the saving user owns that job — finalize's server
 * gate (`assertOwnsTranscriptionJob`) rejects anyone else, so a shared editor
 * who can write the item but didn't create the job must keep using the
 * item-update path (and accept its known gap: see design/pages/
 * transcriptions.md's "Corrections by a shared editor" entry) rather than a
 * finalize call that would only fail.
 */
export function shouldFinalizeItemSave(
  item: Pick<TranscriptItemDetail, "job_id" | "created_by">,
  user: CurrentUser | null | undefined,
): boolean {
  return item.job_id != null && isTranscriptItemOwner(item, user);
}

/**
 * Whether the sharing draft is a deliberate choice rather than an unfinished
 * one — "users"/"roles" picked with nobody actually added yet would silently
 * share with no one, so that state reports as not-yet-chosen. Private and
 * public need no further set-up, so they're always "chosen".
 */
export function isSharingConfigured(
  mode: Mode,
  rbacUsers: RbacUser[],
  rbacRoles: RbacRole[],
): boolean {
  if (mode === "users") return rbacUsers.length > 0;
  if (mode === "roles") return rbacRoles.length > 0;
  return true;
}

export type TranscriptRowKind = "job" | "item";

export type TranscriptState =
  | "recording"
  | "queued"
  | "transcribing"
  | "needs_review"
  | "reviewed"
  | "failed"
  | "ready";

export type TranscriptRow = {
  kind: TranscriptRowKind;
  id: string;
  href: string;
  title: string;
  state: TranscriptState;
  summaryLine: string | null;
  recordedAt: string;
  source: JobSource | null;
  durationSeconds: number | null;
  speakerCount: number | null;
  projectId: string | null;
  rightsMode: Mode | null;
  createdBy: number | null;
  /** Only for kind "job" — the row renderer needs bot status, error, chunk heartbeat. */
  job?: Job;
};

export type TranscriptTab = "all" | "needs_review" | "mine" | "shared";

const JOB_STATE: Partial<Record<JobStatus, TranscriptState>> = {
  recording: "recording",
  queued: "queued",
  transcribing: "transcribing",
  awaiting_review: "needs_review",
  reviewed: "reviewed",
  failed: "failed",
};

/**
 * Where a transcript stands on the two independent axes: reviewed by a
 * human, and present in the knowledge base. `saved_item_id` is the
 * authority on publication — the item is what agents retrieve — so it wins
 * over a status that has not caught up.
 */
export type TranscriptPublishState = "draft" | "reviewed" | "published";

export function transcriptPublishState(job: {
  status: JobStatus;
  saved_item_id?: string | null;
}): TranscriptPublishState {
  if (job.saved_item_id || job.status === "saved") return "published";
  if (job.status === "reviewed") return "reviewed";
  return "draft";
}

/** First non-empty post-processing output, trimmed to one line for the row. */
function itemSummaryLine(item: TranscriptItem): string | null {
  const outputs = parsePostProcessingOutputs(item.post_processing);
  const first = outputs.find((o) => o.status === "done" && o.output?.trim());
  if (!first?.output) return null;
  return first.output.trim().split("\n")[0] ?? null;
}

/**
 * One list across the two stores (spec §1.1). In-progress work comes from
 * transcription_jobs (creator-only); everything ready comes from the RBAC'd
 * knowledge items. A saved job contributes nothing — its content IS the item —
 * which is what keeps the union duplicate-free.
 */
export function mergeTranscriptRows(
  jobs: Job[],
  items: TranscriptItem[],
): TranscriptRow[] {
  const itemRows: TranscriptRow[] = items.map((item) => ({
    kind: "item",
    id: item.id,
    href: `/transcriptions/${item.id}`,
    title: item.name?.trim() || "Untitled transcript",
    state: "ready",
    summaryLine: itemSummaryLine(item),
    recordedAt: item.recorded_at ?? new Date(0).toISOString(),
    source: item.recording_source ?? null,
    durationSeconds: item.duration_seconds,
    speakerCount: item.speaker_count,
    projectId: item.project_id,
    rightsMode: item.rights_mode,
    createdBy: item.created_by,
  }));

  const claimedJobIds = new Set(
    items.map((item) => item.job_id).filter((id): id is string => !!id),
  );

  const jobRows: TranscriptRow[] = jobs
    .filter((job) => {
      // A job that already produced an item is represented by that item.
      // `reviewed` deliberately stays: it is signed off but has no item, so
      // nothing else in the list would represent it.
      if (job.status === "saved" || job.status === "cancelled") return false;
      if (job.saved_item_id) return false;
      return !claimedJobIds.has(job.id);
    })
    .map((job) => ({
      kind: "job",
      id: job.id,
      href: `/transcriptions/review/${job.id}`,
      title: displayTitle(job),
      state: JOB_STATE[job.status] ?? "queued",
      summaryLine: null,
      recordedAt: job.join_at ?? job.createdAt,
      source: job.source ?? null,
      durationSeconds: job.duration_seconds,
      speakerCount: null,
      projectId: job.project_id,
      rightsMode: job.target_rights_mode,
      createdBy: job.created_by,
      job,
    }));

  return [...itemRows, ...jobRows].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

export function filterTranscriptRows(
  rows: TranscriptRow[],
  tab: TranscriptTab,
  currentUserId: number,
): TranscriptRow[] {
  switch (tab) {
    case "needs_review":
      return rows.filter((row) => row.state === "needs_review");
    case "mine":
      return rows.filter(
        (row) => row.kind === "item" && row.createdBy === currentUserId,
      );
    case "shared":
      return rows.filter(
        (row) => row.kind === "item" && row.createdBy !== currentUserId,
      );
    default:
      return rows;
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function groupTranscriptRows(
  rows: TranscriptRow[],
  now: Date,
): { thisWeek: TranscriptRow[]; earlier: TranscriptRow[] } {
  const cutoff = now.getTime() - WEEK_MS;
  const thisWeek: TranscriptRow[] = [];
  const earlier: TranscriptRow[] = [];
  for (const row of rows) {
    // A scheduled meeting bot's join_at is in the future; it belongs at the
    // top of the list, not silently in Earlier.
    if (new Date(row.recordedAt).getTime() >= cutoff) thisWeek.push(row);
    else earlier.push(row);
  }
  return { thisWeek, earlier };
}

/**
 * Whether a raw diarization label is a synthetic placeholder rather than a
 * real person.
 *
 * Providers differ: Whisper diarization emits `SPEAKER_00`, the designs show
 * `Speaker B`, and an unattributed stretch comes through as `unknown`. A
 * meeting bot, by contrast, labels every segment with the participant's
 * actual name — so its "raw" labels need no naming at all.
 */
export function isPlaceholderSpeaker(raw: string): boolean {
  return /^(speaker[\s_-]*[a-z0-9]+|unknown)$/i.test(raw.trim()) || /^\d+$/.test(raw.trim());
}

/**
 * Whether this speaker still needs a name from the reviewer: only true for a
 * placeholder label the reviewer has not yet mapped. A meeting bot's real
 * participant names are already usable, so asking for them again would nag
 * the reviewer to retype what is on screen — and would block the review
 * checklist on work that does not exist.
 */
export function speakerNeedsName(raw: string, names: Record<string, string>): boolean {
  if (names[raw]?.trim()) return false;
  return isPlaceholderSpeaker(raw);
}

/** One run of text in a find/replace preview; `hit` marks a replaced span. */
export interface PreviewPart {
  text: string;
  hit: boolean;
}

export interface FindReplacePreviewRow {
  /** Index into the segments array, so callers can show speaker/time. */
  index: number;
  /** The segment's text as it will read after Replace all, split for display. */
  after: PreviewPart[];
  /** Replacements inside this one segment. */
  count: number;
}

/**
 * What Replace all is about to do, segment by segment.
 *
 * `applyFindReplace` answers "how many" but not "to what", so the modal had
 * nothing to show the user before they committed. This walks the same pattern
 * and emits the resulting text already split into plain runs and replaced
 * runs, so a preview can highlight exactly what changed without re-deriving
 * the match positions (and risking a preview that disagrees with the edit).
 *
 * An empty `replace` is a deletion, which has no span to highlight — the row
 * still appears, so removing a filler word is as reviewable as changing one.
 */
export function findReplacePreview(
  segments: Segment[],
  find: string,
  replace: string,
  matchCase: boolean,
): { rows: FindReplacePreviewRow[]; count: number } {
  if (!find) return { rows: [], count: 0 };
  const pattern = new RegExp(escapeRegExp(find), matchCase ? "g" : "gi");
  const rows: FindReplacePreviewRow[] = [];
  let count = 0;

  segments.forEach((segment, index) => {
    pattern.lastIndex = 0;
    const after: PreviewPart[] = [];
    let cursor = 0;
    let hits = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(segment.text)) !== null) {
      if (match.index > cursor) {
        after.push({ text: segment.text.slice(cursor, match.index), hit: false });
      }
      if (replace) after.push({ text: replace, hit: true });
      cursor = match.index + match[0].length;
      hits += 1;
      // Zero-length matches cannot happen here (find is non-empty and
      // escaped), but guard anyway so a future change cannot spin forever.
      if (match[0].length === 0) pattern.lastIndex += 1;
    }

    if (hits === 0) return;
    if (cursor < segment.text.length) {
      after.push({ text: segment.text.slice(cursor), hit: false });
    }
    count += hits;
    rows.push({ index, after, count: hits });
  });

  return { rows, count };
}
