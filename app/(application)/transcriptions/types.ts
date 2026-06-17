/**
 * Feature types + pure helpers for /transcriptions
 * (codebase-structure §1.1 feature module shape).
 */

export type Mode = "private" | "users" | "roles" | "teams" | "public";

export type JobStatus =
  | "queued"
  | "transcribing"
  | "awaiting_review"
  | "saved"
  | "failed"
  | "cancelled";

export type RbacUser = { id: number; rights: "read" | "write" };
export type RbacRole = { id: string; rights: "read" | "write" };

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

/** Human filename from the `_EXULU_` S3-key convention. */
export function decodeFilename(s3Key: string): string {
  const last = s3Key.split("/").pop() ?? s3Key;
  return last.includes("_EXULU_") ? (last.split("_EXULU_").pop() ?? last) : last;
}

/** Row display name: title, falling back to the decoded filename. */
export function displayTitle(job: Pick<Job, "title" | "audio_s3key">): string {
  return job.title || decodeFilename(job.audio_s3key);
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
