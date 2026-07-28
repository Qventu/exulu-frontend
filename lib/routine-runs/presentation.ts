/**
 * Pure presentation + query-shaping helpers for routine runs (runs v2).
 * No React, no Apollo, no i18n — components resolve labels; this module
 * resolves structure. Unit-tested in presentation.test.ts.
 */

import type { RoutineRun } from "./types";

/** All states job_results can carry once Plan 1 ships (types/enums/jobs.ts). */
export const ALL_RUN_STATES = [
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "stuck",
  "waiting_approval",
  "filtered",
  "cancelled",
] as const;
export type RunState = (typeof ALL_RUN_STATES)[number];

/** Default runs-list view: everything except cheap `filtered` email rows. */
export const NON_FILTERED_STATES: RunState[] = ALL_RUN_STATES.filter(
  (state) => state !== "filtered",
);

/** BullMqJobData.triggerSource values (Plan 1). */
export const RUN_TRIGGERS = ["email", "schedule", "manual", "api"] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

/** Plan-2 guards.ts FilteredReason union. */
export const KNOWN_FILTERED_REASONS = [
  "sender_not_allowed",
  "filter",
  "rate_limited",
  "duplicate",
  "auto_reply",
] as const;

/**
 * Badge classes per state. Legacy seven mirror the RunsSection STATE_BADGE
 * map byte-for-byte; waiting_approval is the prominent amber "Needs
 * attention" (design §7.2); filtered/cancelled are muted terminal rows.
 */
export const RUN_STATE_BADGE: Record<string, string> = {
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  stuck: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-info/15 text-info border-info/30",
  waiting: "bg-info/15 text-info border-info/30",
  delayed: "bg-warning/15 text-warning border-warning/30",
  paused: "bg-muted text-muted-foreground border-border",
  waiting_approval: "bg-warning/15 text-warning border-warning/40 font-medium",
  filtered: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export interface RunDot {
  status: "success" | "warning" | "error" | "info" | "muted";
  pulse: boolean;
}

/** StatusDot mapping — superset of the legacy RunsSection mapDot(). */
export function mapRunDot(state?: string): RunDot {
  switch (state) {
    case "completed":
      return { status: "success", pulse: false };
    case "failed":
    case "stuck":
      return { status: "error", pulse: false };
    case "active":
      return { status: "info", pulse: true };
    case "waiting":
    case "delayed":
    case "paused":
      return { status: "info", pulse: false };
    case "waiting_approval":
      return { status: "warning", pulse: true };
    case "filtered":
    case "cancelled":
    default:
      return { status: "muted", pulse: false };
  }
}

/** Row preview title: email subject → routine name → "" (design §7.2). */
export function runTitle(
  run: Pick<RoutineRun, "trigger_metadata" | "workflowName">,
): string {
  const subject = run.trigger_metadata?.subject;
  if (typeof subject === "string" && subject.trim() !== "") return subject;
  return run.workflowName ?? "";
}

export interface TriggerBadge {
  key: RunTrigger | "none";
  detail?: string;
}

/** Trigger badge: `email · sender@…` / schedule / manual / api / "—". */
export function triggerBadge(
  run: Pick<RoutineRun, "trigger" | "trigger_metadata">,
): TriggerBadge {
  const trigger = run.trigger;
  if (!(RUN_TRIGGERS as readonly string[]).includes(trigger ?? "")) {
    return { key: "none" };
  }
  if (trigger === "email") {
    const from = run.trigger_metadata?.from;
    return typeof from === "string" && from !== ""
      ? { key: "email", detail: from }
      : { key: "email" };
  }
  return { key: trigger as RunTrigger };
}

/** cancelRoutineRun CAS domain: waiting | active | waiting_approval. */
export function canCancelRun(state: string): boolean {
  return (
    state === "waiting" || state === "active" || state === "waiting_approval"
  );
}

/** retryRoutineRun domain: failed | cancelled only (design §6). */
export function canRetryRun(state: string): boolean {
  return state === "failed" || state === "cancelled";
}

/** deleteRoutineRun domain: terminal runs only (mirrors TERMINAL_JOB_STATES). */
export function canDeleteRun(state: string): boolean {
  return isTerminalRunState(state);
}

/** Mirrors Plan 1 TERMINAL_JOB_STATES. */
export function isTerminalRunState(state: string): boolean {
  return (
    state === "completed" ||
    state === "failed" ||
    state === "filtered" ||
    state === "cancelled"
  );
}

export interface SelectionPartition {
  /** selected run ids that can be cancelled (canCancelRun). */
  cancellable: string[];
  /** selected run ids that can be deleted (canDeleteRun / terminal). */
  deletable: string[];
}

/** Splits the selected run ids into the subset each bulk action can act on. */
export function partitionSelection(
  runs: { id: string; state: string }[],
  selectedIds: ReadonlySet<string>,
): SelectionPartition {
  const cancellable: string[] = [];
  const deletable: string[] = [];
  for (const run of runs) {
    if (!selectedIds.has(run.id)) continue;
    if (canCancelRun(run.state)) cancellable.push(run.id);
    else if (canDeleteRun(run.state)) deletable.push(run.id);
  }
  return { cancellable, deletable };
}

export function needsAttention(state: string): boolean {
  return state === "waiting_approval";
}

export function filteredReason(
  run: Pick<RoutineRun, "trigger_metadata">,
): string | undefined {
  const reason = run.trigger_metadata?.filtered_reason;
  return typeof reason === "string" && reason !== "" ? reason : undefined;
}

/** "3s" / "1m 5s" / "2h 3m" for terminal runs; null otherwise. */
export function formatRunDuration(
  createdAt?: string | null,
  updatedAt?: string | null,
  state?: string,
): string | null {
  if (!state || !isTerminalRunState(state)) return null;
  if (!createdAt || !updatedAt) return null;
  const start = new Date(createdAt).getTime();
  const end = new Date(updatedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  const totalSeconds = Math.round((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** UI filter-bar state (widget-owned; page resets ride every patch). */
export interface RunsFilterState {
  /** "all" or one RunState. */
  state: string;
  /** "all" or one RunTrigger. */
  trigger: string;
  /** datetime-local strings (empty = unset). */
  from?: string;
  to?: string;
  search: string;
  needsAttention: boolean;
  showFiltered: boolean;
  page: number;
}

export const DEFAULT_RUNS_FILTER: RunsFilterState = {
  state: "all",
  trigger: "all",
  search: "",
  needsAttention: false,
  showFiltered: false,
  page: 1,
};

/**
 * Map the UI filter state onto the exact `routineRuns` variables (contract
 * §6). Filtered rows are excluded by DEFAULT via an explicit states list —
 * the backend has no "not filtered" operator.
 */
export function buildRoutineRunsVariables(
  filter: RunsFilterState,
  opts: { workflow?: string; limit: number },
): Record<string, unknown> {
  const vars: Record<string, unknown> = {
    page: filter.page,
    limit: opts.limit,
  };
  if (opts.workflow) vars.workflow = opts.workflow;
  if (filter.state !== "all") {
    vars.states = [filter.state];
  } else if (!filter.showFiltered) {
    vars.states = NON_FILTERED_STATES;
  }
  if (filter.trigger !== "all") vars.triggers = [filter.trigger];
  if (filter.from) vars.from = new Date(filter.from).toISOString();
  if (filter.to) vars.to = new Date(filter.to).toISOString();
  const search = filter.search.trim();
  if (search !== "") vars.search = search;
  if (filter.needsAttention) vars.needsAttention = true;
  return vars;
}
