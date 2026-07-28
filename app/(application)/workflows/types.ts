/**
 * Domain types for /workflows (Routines) — work item 2.12.
 *
 * Terminology: "Routine" is the user-facing name; "workflow" survives only in
 * code identifiers tied to the GraphQL contracts (workflow_template* ops,
 * RUN_WORKFLOW, etc. — see workflows.md §3 "Naming decision").
 */

import type { FileUIPart, UIMessage } from "ai";

// ---- Domain (mirrors GraphQL workflow_template row) -------------------------

export type RoutineRightsMode =
  | "private"
  | "users"
  | "roles"
  | "teams"
  | "public";

export interface RoutineRbacEntry {
  id: string | number;
  rights: "read" | "write";
}

export interface RoutineRbac {
  type?: RoutineRightsMode;
  users: RoutineRbacEntry[];
  roles: RoutineRbacEntry[];
  /** Present only when ROUTINES_RBAC_TEAMS_SUPPORTED=true; otherwise []. */
  teams: RoutineRbacEntry[];
}

export interface Routine {
  id: string;
  name: string;
  description?: string | null;
  /** Agent id (string). May be empty when the agent was removed. */
  agent: string;
  /** Queue name the routine runs on (workflow_templates.queue). Required to run. */
  queue?: string | null;
  /** Resolver-derived display name; populated by useAgentsForPage. */
  agentName?: string | null;
  /** Agent queue (if any); populated by useAgentsForPage. */
  agentQueueName?: string | null;
  created_by: number;
  rights_mode: RoutineRightsMode;
  RBAC: RoutineRbac;
  variables?: string[] | null;
  steps_json?: UIMessage[] | null;
  createdAt: string;
  updatedAt: string;

  /** Populated by hooks only when ROUTINES_LAST_RUN_EMBEDDED_SUPPORTED=true. */
  lastRun?: { state: string; createdAt: string } | null;
  /** Populated by hooks only when ROUTINES_SCHEDULE_EMBEDDED_SUPPORTED=true. */
  schedule?: { schedule: string; next?: string | null } | null;
}

// ---- Selection / panel state ------------------------------------------------

export type RoutinePanelTab = "overview" | "runs" | "schedule" | "queue";

export interface RoutinePanelSelection {
  routineId: string;
  tab?: RoutinePanelTab;
  /** When set, Runs tab opens with this run pre-selected. */
  runId?: string;
}

// ---- Run dialog handshake (page-level) --------------------------------------

export interface RunRoutineRequest {
  /** Workflow template id (the GraphQL identifier is "workflow"). */
  id: string;
  /** Resolved at row-press from the agent's queue (undefined -> immediate). */
  queue?: string;
  /** Variable names to render input fields for. */
  variables?: string[];
  /** Optional prefilled values (used by "Retry with edits" from QueuePanel). */
  prefill?: Record<string, string>;
  /** Display name for toast copy. */
  routineName?: string;
}

// ---- Schedule editor --------------------------------------------------------

export type RoutineScheduleMode = "preset" | "custom";

export interface RoutineScheduleValue {
  cron: string;
  mode: RoutineScheduleMode;
}

// ---- Access derivation ------------------------------------------------------

export interface RoutineAccess {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean; // === canWrite today
  canRun: boolean;    // === canWrite today
}

// ---- File-attachment plumbing (editor steps) --------------------------------

/** The currently-staged file parts in the editor composer. */
export interface RoutineComposerStagedFiles {
  parts: FileUIPart[];
  s3Keys: string[];
}

// =============================================================================
// CHAT HANDSHAKE — byte-equivalent payload chat sends to the routine editor.
// This is the contract that must NOT regress.
// Source: app/(application)/chat/components/chat-header.tsx (lines 459-466).
// =============================================================================

/**
 * Chat opens the routine editor by mounting `<SaveWorkflowModal>` with these
 * props. The routines route must keep accepting the same shape (the
 * SaveWorkflowModal barrel re-export keeps the identical surface area).
 *
 * Verifier diff-checks chat/** is byte-untouched; this interface is the
 * contract chat is allowed to depend on.
 *
 * After work item 2.13 (RoutineEditorDialog reduced to CREATE-only), the
 * dialog no longer supports editing an existing routine — `existingWorkflow`
 * and `isReadOnly` are permanently absent. They are typed as `never` so any
 * future TS consumer that tries to pass them will fail to compile.
 */
export interface ChatSaveAsRoutineHandshake {
  isOpen: boolean;
  onClose: () => void;
  /** The chat session's messages (will be flattened to steps_json). */
  messages: UIMessage[];
  /** Agent id from the chat session. REQUIRED to keep agent attached on save. */
  agentId: string;
  /** Session title — prefills `name` on first open. */
  sessionTitle?: string;
  /** Permanently absent — edit path lives inline at /workflows/[id]. */
  existingWorkflow?: never;
  /** Permanently absent — view path lives inline at /workflows/[id]. */
  isReadOnly?: never;
}
