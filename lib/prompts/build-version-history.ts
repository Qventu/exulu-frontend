import type { PromptLibrary, PromptVersion } from "@/types/models/prompt-library";

/**
 * Edit-time version-history building (inventory item 44; extracted from
 * `prompt-editor-modal.tsx:179-233` per prompts.md §4 implementation note
 * "extract version-building to lib/prompts/build-version-history.ts").
 *
 * Pure: no React, no I/O. Caller passes the prior prompt, the next field
 * values, the acting user id, and (optionally) a change message; we return
 * the new history array to send with `UPDATE_PROMPT`.
 *
 * Rules preserved verbatim from the legacy implementation:
 * - A history entry is APPENDED only when at least one of content / name /
 *   description / tags actually changed.
 * - Squash: if the last entry was written by the same user within 5 minutes,
 *   the new entry REPLACES it instead of appending — keeps the timeline
 *   short during interactive editing.
 * - Cap: keep only the last 50 entries (sliced from the end).
 *
 * The cross-feature CONSEQUENCE: the agents PromptBrowserSheet's direct
 * `assigned_agents` Add/Remove write path (prompts.md item 70) correctly
 * produces no history entry because none of {content, name, description,
 * tags} changes — see prompts.md §4 "That write path correctly produces no
 * version-history entry".
 */
const SQUASH_WINDOW_MS = 5 * 60 * 1000;
const HISTORY_CAP = 50;

export interface BuildVersionHistoryParams {
  prompt: PromptLibrary;
  next: {
    content: string;
    name: string;
    description?: string;
    tags?: string[];
  };
  userId: string;
  changeMessage?: string;
  /** Override clock for testability. Defaults to `Date.now()`. */
  now?: number;
}

export function buildVersionHistory({
  prompt,
  next,
  userId,
  changeMessage,
  now = Date.now(),
}: BuildVersionHistoryParams): PromptVersion[] | undefined {
  const existing = prompt.history ?? [];

  const contentChanged = prompt.content !== next.content;
  const nameChanged = prompt.name !== next.name;
  const descriptionChanged =
    (prompt.description ?? "") !== (next.description ?? "");
  const tagsChanged =
    JSON.stringify(prompt.tags ?? []) !== JSON.stringify(next.tags ?? []);

  if (!contentChanged && !nameChanged && !descriptionChanged && !tagsChanged) {
    // No tracked-field changes → leave history exactly as-is. Caller may
    // either omit `history` from the mutation input or pass the existing
    // array; returning `undefined` lets callers branch explicitly.
    return undefined;
  }

  const nextVersionNumber =
    existing.length > 0 ? Math.max(...existing.map((v) => v.version)) + 1 : 1;

  const last = existing[existing.length - 1];
  const shouldSquash =
    last !== undefined &&
    last.changed_by === userId &&
    new Date(last.timestamp).getTime() > now - SQUASH_WINDOW_MS;

  const entry: PromptVersion = {
    // Squash reuses the prior version number; the snapshot still describes
    // the state BEFORE this edit (consistent with the legacy code).
    version: shouldSquash ? last!.version : nextVersionNumber,
    content: prompt.content,
    name: prompt.name,
    description: prompt.description,
    tags: prompt.tags,
    timestamp: new Date(now).toISOString(),
    changed_by: userId,
    change_message: changeMessage?.trim() || undefined,
  };

  const replaced = shouldSquash
    ? [...existing.slice(0, -1), entry]
    : [...existing, entry];

  return replaced.length > HISTORY_CAP ? replaced.slice(-HISTORY_CAP) : replaced;
}

/**
 * Restore-time history building: appends a snapshot of the CURRENT state
 * before restoring an older version. Caller-supplied `changedBy` MUST be the
 * acting user (fixes prompts.md M9 — the legacy version-restore-modal used
 * `prompt.created_by`, mis-attributing every restore to the original author).
 */
export function buildRestoreHistory({
  prompt,
  changedBy,
  changeMessage,
  now = Date.now(),
}: {
  prompt: PromptLibrary;
  changedBy: string;
  changeMessage?: string;
  now?: number;
}): PromptVersion[] {
  const existing = prompt.history ?? [];
  const nextVersionNumber =
    existing.length > 0 ? Math.max(...existing.map((v) => v.version)) + 1 : 1;

  const entry: PromptVersion = {
    version: nextVersionNumber,
    content: prompt.content,
    name: prompt.name,
    description: prompt.description,
    tags: prompt.tags,
    timestamp: new Date(now).toISOString(),
    changed_by: changedBy,
    change_message: changeMessage?.trim() || undefined,
  };

  const next = [...existing, entry];
  return next.length > HISTORY_CAP ? next.slice(-HISTORY_CAP) : next;
}
