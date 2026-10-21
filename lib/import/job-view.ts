/**
 * Pure view model for a server-side import's `job_result` row (GET_IMPORT_JOBS,
 * lib/api/imports.ts) — no GraphQL, no React. `metadata`, `result` and
 * `trigger_metadata` are JSON columns that may come back from Apollo as
 * already-parsed objects or as JSON-encoded strings (schema says `JSON`,
 * drivers vary); every reader goes through `asRecord` below to normalise.
 */
import type { BatchAccess } from "@/lib/import/types";

/** Raw row shape selected by GET_IMPORT_JOBS — exactly the job_result fields in use. */
export interface ImportJobRow {
  id: string;
  label: string;
  /** Backend job state — a bare string; mapped to ImportJobView.state below. */
  state: string;
  type?: string | null;
  context?: string | null;
  trigger?: string | null;
  /** JSON string or object: `{ fileName, user: { id, super_admin, role, team } | number }`. */
  trigger_metadata?: unknown;
  /** JSON string or object: running-progress counters, written by the worker as it goes. */
  metadata?: unknown;
  /** JSON string or object: final counters + errorReportKey + durationMs, written on completion. */
  result?: unknown;
  /** JSON string of a serialised error, or a bare message string. */
  error?: unknown;
  createdAt: string;
  updatedAt?: string | null;
}

export type ImportJobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "other";

const KNOWN_STATES: readonly ImportJobState[] = [
  "waiting",
  "active",
  "completed",
  "failed",
  "cancelled",
];

export interface ImportJobCounters {
  total: number | null;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  invalid: number;
}

export interface ImportJobView {
  id: string;
  fileName: string;
  /**
   * The batch access the run was started with (`trigger_metadata.access`),
   * null when the row carries none or an unknown rights mode. A retry
   * re-imports with THIS, not with whatever the wizard currently defaults
   * to — reopening the dialog resets its own batch access.
   */
  access: BatchAccess | null;
  state: ImportJobState;
  progress: number | null;
  counters: ImportJobCounters;
  errorReportKey: string | null;
  startedBy: number | null;
  durationMs: number | null;
  isRunning: boolean;
  canRetry: boolean;
  /** The row's `error` column, message extracted when it's a serialised error. */
  error: string | null;
}

/** Normalises a JSON-or-already-parsed column into a plain record (never throws). */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not JSON — treated as no structured data.
    }
  }
  return {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** `result.<key>` if present there, else `metadata.<key>` — per-field fallback (not a blind merge, since an explicit `null` in `result` must not shadow a real value in `metadata`). */
function fromResultThenMetadata(
  result: Record<string, unknown>,
  metadata: Record<string, unknown>,
  key: string,
): unknown {
  return result[key] ?? metadata[key];
}

/** `trigger_metadata.user.id`, tolerating a bare number in place of the snapshot object. */
function readStartedBy(triggerMetadata: Record<string, unknown>): number | null {
  const user = triggerMetadata.user;
  if (typeof user === "number") return numberOrNull(user);
  if (user && typeof user === "object") {
    return numberOrNull((user as Record<string, unknown>).id);
  }
  return null;
}

/** The row's `error` column: JSON-serialised errors surface their `.message`; anything else passes through as-is. */
function readError(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as Record<string, unknown>).message === "string"
    ) {
      return (parsed as Record<string, unknown>).message as string;
    }
  } catch {
    // Not JSON — the raw string IS the message.
  }
  return raw;
}

const RIGHTS_MODES: readonly BatchAccess["rights_mode"][] = [
  "private",
  "users",
  "roles",
  "teams",
  "public",
];

/** A stored grant list, defaulted to `[]` for the `null` the backend allows. */
function asGrantList<K extends keyof BatchAccess>(
  value: unknown,
): BatchAccess[K] {
  return (Array.isArray(value) ? value : []) as BatchAccess[K];
}

/** `trigger_metadata.access` — the access this run created its items with. */
function readAccess(
  triggerMetadata: Record<string, unknown>,
): BatchAccess | null {
  const access = asRecord(triggerMetadata.access);
  const mode = access.rights_mode;
  if (
    typeof mode !== "string" ||
    !(RIGHTS_MODES as readonly string[]).includes(mode)
  ) {
    return null;
  }
  return {
    rights_mode: mode as BatchAccess["rights_mode"],
    users: asGrantList<"users">(access.users),
    roles: asGrantList<"roles">(access.roles),
    teams: asGrantList<"teams">(access.teams),
  };
}

/**
 * Badge variant per job state — shared by the wizard's run step and the
 * pipeline tab's imports card so one state never reads as two things.
 */
export const STATE_BADGE: Record<
  ImportJobState,
  "default" | "secondary" | "success" | "destructive" | "outline"
> = {
  waiting: "secondary",
  active: "default",
  completed: "success",
  failed: "destructive",
  cancelled: "outline",
  other: "outline",
};

/** `big.csv` → `big-errors.csv`, the name a retry re-imports under. */
export function errorReportFileName(fileName: string): string {
  return `${fileName.replace(/\.csv$/i, "")}-errors.csv`;
}

function toJobState(state: string): ImportJobState {
  return (KNOWN_STATES as readonly string[]).includes(state)
    ? (state as ImportJobState)
    : "other";
}

/** Builds the pure view model a job-progress card renders from a job_result row. */
export function toImportJobView(row: ImportJobRow): ImportJobView {
  const metadata = asRecord(row.metadata);
  const result = asRecord(row.result);
  const triggerMetadata = asRecord(row.trigger_metadata);

  const state = toJobState(row.state);
  const isRunning = state === "waiting" || state === "active";

  const total = numberOrNull(fromResultThenMetadata(result, metadata, "total"));
  const processed = numberOrZero(
    fromResultThenMetadata(result, metadata, "processed"),
  );
  const counters: ImportJobCounters = {
    total,
    processed,
    created: numberOrZero(fromResultThenMetadata(result, metadata, "created")),
    updated: numberOrZero(fromResultThenMetadata(result, metadata, "updated")),
    failed: numberOrZero(fromResultThenMetadata(result, metadata, "failed")),
    invalid: numberOrZero(fromResultThenMetadata(result, metadata, "invalid")),
  };

  const progress =
    total !== null && total > 0 ? Math.round((processed / total) * 100) : null;

  const errorReportKey = stringOrNull(
    fromResultThenMetadata(result, metadata, "errorReportKey"),
  );

  const fileName = stringOrNull(triggerMetadata.fileName) ?? row.label;
  const startedBy = readStartedBy(triggerMetadata);
  const durationMs = numberOrNull(result.durationMs);

  return {
    id: row.id,
    fileName,
    access: readAccess(triggerMetadata),
    state,
    progress,
    counters,
    errorReportKey,
    startedBy,
    durationMs,
    isRunning,
    canRetry: !!errorReportKey && !isRunning,
    error: readError(row.error),
  };
}
