/**
 * Hand-maintained types for the Plan-1 `routineRuns` GraphQL API (contract
 * SDL in docs/superpowers/specs/2026-07-15-email-triggered-routines-design.md
 * §6). Keep in sync with the backend; same convention as types/models/*.
 */

/** trigger_metadata JSON — email runs carry from/subject/message_id, schedule runs carry cron, filtered rows add filtered_reason/failed_rule. */
export interface RoutineRunTriggerMetadata {
  from?: string;
  subject?: string;
  message_id?: string;
  filtered_reason?: string;
  failed_rule?: string;
  cron?: string;
}

export interface RoutineRun {
  id: string;
  job_id?: string | null;
  state: string;
  /** 'email' | 'schedule' | 'manual' | 'api' — NULL for pre-migration rows. */
  trigger?: string | null;
  trigger_metadata?: RoutineRunTriggerMetadata | null;
  /** agent_sessions id of the session-backed run (NULL for filtered rows). */
  session?: string | null;
  workflow: string;
  workflowName?: string | null;
  /** Agent id (workflow_templates.agent) — the /chat/[agent] route param. */
  agent?: string | null;
  error?: unknown;
  tries?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RoutineRunPage {
  items: RoutineRun[];
  total: number;
}
