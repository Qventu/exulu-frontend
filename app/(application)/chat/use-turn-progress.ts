"use client";

/**
 * useTurnProgress — chat-domain knowledge of "did a turn, or one of its tool
 * calls, just finish" turned into a bump counter a host outside chat can
 * react to (artifact-agent-panel plan, Task 10).
 *
 * Lives in the chat feature on purpose, not in artifacts: "did this tool part
 * reach a terminal state" and "did the turn just end" are facts about the
 * transport (`controller.messages` / `controller.status`), not about any one
 * consumer of them. `AgentPanel` (artifacts/open/[name]) is the first host to
 * call it, via `SessionScreenInner`, but nothing here names an artifact — the
 * same way `tool-call-group-data.ts` and `tool-trace-data.ts` roll up tool
 * states with no knowledge of where the rollup is displayed.
 *
 * Two signals, folded into one monotonic nonce:
 *  - a tool part reaching `output-available` OR `output-error`. A failed tool
 *    can still have written to whatever the artifact reads, so an error
 *    counts exactly like a success — the artifact should refetch either way.
 *  - the `streaming -> ready` transition: a finished turn.
 *
 * Deliberately NOT `onToolCall` (hooks.ts, inside `useChat`'s init): that
 * fires when a tool is *called*, before it has run — using it here would
 * tell the artifact "something changed" before anything had.
 *
 * `nonce` increments on every bump and never resets; `reason` names whichever
 * bump produced the CURRENT nonce. A caller that only cares "did something
 * change" diffs the nonce alone (the artifact panel does exactly this — the
 * frame refetches on either reason).
 *
 * `SessionScreenInner` is shared by every `SessionScreen` caller, including
 * the internal /chat/<agent>/<session> page that never passes `onProgress` —
 * so this hook runs on every ordinary chat turn too, not just an artifact
 * panel's. Without `enabled`, that would mean an extra message scan and a
 * `setProgress` commit, on every tool completion and every finished turn, for
 * a value nobody reads. `enabled` keeps the hook itself unconditional (React's
 * rule), but turns its body into a no-op when false — EXCEPT
 * `prevStatusRef`, which is kept current regardless. Skipping that too would
 * leave it stuck on whatever status was current when `enabled` went false;
 * if the caller later flips to `enabled: true` after a real transition had
 * already happened unseen, the stale `prev` would make the NEXT status change
 * misread as "streaming -> ready" even though it was not — a phantom bump
 * surfacing late, for a transition this hook was never asked to watch.
 */

import { isToolUIPart } from "ai";
import * as React from "react";

import type { ChatSessionController, ChatStatus } from "./hooks";

export interface TurnProgress {
  nonce: number;
  reason: "tool" | "turn";
}

/** The two states a tool part cannot come back from: a result, or a failure. */
const TERMINAL_STATES = new Set<string>(["output-available", "output-error"]);

export function useTurnProgress(
  controller: Pick<ChatSessionController, "messages" | "status">,
  enabled: boolean,
): TurnProgress {
  const { messages, status } = controller;

  const [progress, setProgress] = React.useState<TurnProgress>({
    nonce: 0,
    reason: "turn",
  });
  // A stable identity so it can sit in both effects' dependency arrays
  // without re-triggering them on every render.
  const bump = React.useCallback((reason: "tool" | "turn") => {
    setProgress((prev) => ({ nonce: prev.nonce + 1, reason }));
  }, []);

  // --- tool-call completion --------------------------------------------------
  // Seen ids live in a ref, not state: they must survive across renders so a
  // re-render over the SAME terminal part (an unrelated sibling re-rendering
  // this hook's host, or the exact same message array handed back) can never
  // bump twice for it. Never cleared — a toolCallId is unique for the life of
  // the session, and this only needs to know it has already counted one.
  const seenToolCallIds = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    // Disabled: no scan, no `setProgress` — the whole point of the flag.
    // Nothing is recorded into `seenToolCallIds` either, so re-enabling
    // later sees every still-unseen completion fresh, same as a first mount
    // would.
    if (!enabled) return;
    for (const message of messages) {
      for (const part of message.parts) {
        // `isToolUIPart` (from "ai") is the library's own guard for "a static
        // tool-<name> part OR a dynamic-tool part" — the two part shapes that
        // carry `toolCallId`/`state`. Text, reasoning, file and source parts
        // never do, and must not be dereferenced as if they did.
        if (!isToolUIPart(part)) continue;
        if (!TERMINAL_STATES.has(part.state)) continue;
        if (seenToolCallIds.current.has(part.toolCallId)) continue;
        seenToolCallIds.current.add(part.toolCallId);
        bump("tool");
      }
    }
  }, [messages, enabled, bump]);

  // --- turn completion (streaming -> ready) ----------------------------------
  // Mirrors hooks.ts's own prevStatusRef effect (the session-files-count
  // refresh) exactly — prev === "streaming" only. NOT the broader claim-check
  // effect in the same file, which also treats submitted -> ready as a
  // completion (a tool-only turn with no streamed text). The brief names this
  // one transition; widening past it is a decision for whoever owns that
  // tradeoff, not something to pick up as a side effect of this task.
  const prevStatusRef = React.useRef<ChatStatus>(status);
  React.useEffect(() => {
    const prev = prevStatusRef.current;
    // Written unconditionally — see the file header's note on why a
    // disabled render must not leave this stale.
    prevStatusRef.current = status;
    if (!enabled) return;
    if (prev === "streaming" && status === "ready") bump("turn");
  }, [status, enabled, bump]);

  return progress;
}

/**
 * useProgressRelay — turns a `TurnProgress` value into exactly one call to
 * `onProgress` per actual nonce change, and zero calls for a render where it
 * didn't move.
 *
 * Extracted out of `SessionScreenInner` (rather than inlined there) so this
 * exact gating — the mechanism that keeps a mount from announcing a
 * fabricated event, and that collapses several of `useTurnProgress`'s own
 * bumps landing in one React commit (it batches them) into one outward call
 * — is directly testable against a bare `{nonce, reason}` value, with no
 * `ChatSessionController`, no `useChatSession`, no Apollo mock required.
 *
 * `lastNonceRef` seeds to whatever nonce `progress` carries on THIS hook's
 * own first render, not to a hardcoded `0`. In the composed pipeline that
 * happens to always be `0` (`useTurnProgress`'s own initial state), so a
 * panel opened on a session whose history already has completed tool calls
 * is still relayed exactly once — its first render reports `0`, and only the
 * SECOND render (after `useTurnProgress`'s mount effects have batched their
 * bumps) reports the real count, which is what this ref then sees change.
 * Seeding to the live value rather than `0` keeps that "no call on the very
 * first look" guarantee a property of this hook alone, so it holds even when
 * tested in isolation against a `progress` that starts non-zero.
 */
export function useProgressRelay(
  progress: TurnProgress,
  onProgress?: (reason: "tool" | "turn") => void,
): void {
  const lastNonceRef = React.useRef(progress.nonce);
  React.useEffect(() => {
    if (lastNonceRef.current === progress.nonce) return;
    lastNonceRef.current = progress.nonce;
    onProgress?.(progress.reason);
  }, [progress.nonce, progress.reason, onProgress]);
}
