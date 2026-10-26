/**
 * Pure logic behind the grouped tool card — the parallel fan-out case where
 * the model issues the same tool N times in one step (20 × jira_get_issue in
 * session 131113e2). Extracted per the repo's pure-module test convention
 * (see credential-request-data.ts): no React, no fetch.
 *
 * Owns two things: the short input preview shown per call, and the roll-up of
 * N member states into the one state the group header shows.
 */
import type { DynamicToolUIPart, ToolUIPart } from "ai";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Short, human-readable preview of a tool input: well-known string fields
 * first, then the first short string value. Shared by the single-call approval
 * card and the grouped card so one call and twenty read the same way.
 */
export const getInputSummary = (input: unknown): string | null => {
  if (!isRecord(input)) return null;
  const preferredKeys = [
    "path",
    "file_path",
    "filename",
    "command",
    "query",
    "url",
    "question",
    "prompt",
    "text",
  ];
  for (const key of preferredKeys) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  const firstString = Object.values(input).find(
    (value) =>
      typeof value === "string" && value.length > 0 && value.length < 300,
  );
  return typeof firstString === "string" ? firstString : null;
};

export interface ToolGroupSummary {
  /** Approval ids still awaiting a response, in call order. */
  pendingApprovalIds: string[];
  /** True when no member has run yet — the "approve the whole batch" case. */
  allPending: boolean;
  approvedCount: number;
  deniedCount: number;
  errorCount: number;
  /** One state for the group header. */
  state: ToolUIPart["state"];
  /** Per-call input preview, index-aligned with the group's parts. */
  inputSummaries: (string | null)[];
  /**
   * A member short-circuited into a credential / oauth request. Those need
   * their own actionable card, so the group renderer must not collapse them.
   */
  hasAuthShortCircuit: boolean;
}

const RUNNING_STATES = new Set<string>([
  "input-streaming",
  "input-available",
  // The approval came back but the tool has not produced output yet.
  "approval-responded",
]);

/**
 * Rolls N member states up into one, in the order the user needs to act:
 * something to approve > something still running > something broke >
 * something refused > all done.
 */
export const aggregateToolState = (parts: DynamicToolUIPart[]): ToolUIPart["state"] => {
  const states = parts.map((part) => part.state as string);
  if (states.includes("approval-requested")) return "approval-requested";
  if (states.some((state) => RUNNING_STATES.has(state))) return "input-available";
  if (states.includes("output-error")) return "output-error";
  if (states.includes("output-denied")) return "output-denied";
  return "output-available";
};

const hasAuthPayload = (part: DynamicToolUIPart): boolean => {
  const output = (part as { output?: unknown }).output;
  if (!isRecord(output)) return false;
  if (isRecord(output.credentialRequest)) return true;
  const oauth = output.oauth;
  return isRecord(oauth) && typeof oauth.authorizationUrl === "string";
};

export function summarizeToolGroup(
  parts: DynamicToolUIPart[],
): ToolGroupSummary {
  const pendingApprovalIds: string[] = [];
  let approvedCount = 0;
  let deniedCount = 0;
  let errorCount = 0;
  let hasAuthShortCircuit = false;
  let ranCount = 0;

  for (const part of parts) {
    const approval = (part as { approval?: { id?: unknown; approved?: unknown } })
      .approval;

    if (part.state === "approval-requested") {
      if (typeof approval?.id === "string") pendingApprovalIds.push(approval.id);
    } else {
      ranCount += 1;
      if (approval?.approved === true) approvedCount += 1;
    }

    if (part.state === "output-denied" || approval?.approved === false) {
      deniedCount += 1;
    }
    if (part.state === "output-error") errorCount += 1;
    if (hasAuthPayload(part)) hasAuthShortCircuit = true;
  }

  return {
    pendingApprovalIds,
    allPending: ranCount === 0,
    approvedCount,
    deniedCount,
    errorCount,
    state: aggregateToolState(parts),
    inputSummaries: parts.map((part) => getInputSummary(part.input)),
    hasAuthShortCircuit,
  };
}
