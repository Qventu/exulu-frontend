import type { UIMessage } from "ai";

/**
 * Frontend mirror of exulu/backend src/exulu/context-budget.ts — the formulas
 * MUST match byte-for-byte (spec: 2026-07-07-context-window-management).
 * chars/4 estimation; real per-turn usage metadata anchors the numbers.
 */

export type ContextBudget = {
  contextWindow: number;
  outputReserve: number;
  usableWindow: number;
  warnThreshold: number;
  blockThreshold: number;
};

export const deriveContextBudget = (contextWindow: number): ContextBudget => {
  const outputReserve = Math.min(32_000, Math.floor(contextWindow * 0.2));
  const usableWindow = contextWindow - outputReserve;
  return {
    contextWindow,
    outputReserve,
    usableWindow,
    warnThreshold: Math.floor(usableWindow * 0.8),
    blockThreshold: Math.floor(usableWindow * 0.95),
  };
};

export const estimateTokens = (text: string): number => (text ? Math.ceil(text.length / 4) : 0);

export type CompactionMetadata = {
  coversUpTo: string;
  originalTokens: number;
  summaryTokens: number;
  occupancyEstimate: number;
  steer?: string;
};

export const getCompaction = (message: UIMessage): CompactionMetadata | undefined =>
  (message.metadata as { compaction?: CompactionMetadata } | undefined)?.compaction;

// Frontend-only memoization (the backend mirror needs no counterpart — the
// formula and results are unchanged): finished UIMessage objects are
// reference-stable across stream ticks (the AI SDK deep-clones only the
// in-progress message), so the per-message estimate is cached by object
// identity. Without this, every throttled stream tick re-stringified the
// whole unanchored tail of the conversation.
const messageTokenCache = new WeakMap<UIMessage, number>();

export const estimateMessageTokens = (message: UIMessage): number => {
  const cached = messageTokenCache.get(message);
  if (cached !== undefined) return cached;
  const estimate = estimateTokens(JSON.stringify(message));
  messageTokenCache.set(message, estimate);
  return estimate;
};

export const computeContextOccupancy = (messages: UIMessage[]): number => {
  let anchorIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    const meta = m.metadata as { inputTokens?: number; lastStepInputTokens?: number } | undefined;
    if (
      getCompaction(m) ||
      (m.role === "assistant" &&
        (typeof meta?.inputTokens === "number" || typeof meta?.lastStepInputTokens === "number"))
    ) {
      anchorIdx = i;
      break;
    }
  }
  let total = 0;
  let rest = messages;
  if (anchorIdx !== -1) {
    const anchor = messages[anchorIdx]!;
    const compaction = getCompaction(anchor);
    if (compaction) {
      total = compaction.occupancyEstimate;
    } else {
      const meta = anchor.metadata as {
        inputTokens?: number;
        outputTokens?: number;
        lastStepInputTokens?: number;
        lastStepOutputTokens?: number;
      };
      total =
        typeof meta.lastStepInputTokens === "number"
          ? meta.lastStepInputTokens + (meta.lastStepOutputTokens ?? 0)
          : (meta.inputTokens ?? 0) + (meta.outputTokens ?? 0);
    }
    rest = messages.slice(anchorIdx + 1);
  }
  for (const m of rest) total += estimateMessageTokens(m);
  return total;
};

export type ContextState = "ok" | "warn" | "blocked";

export const deriveContextState = (
  occupancy: number,
  budget: ContextBudget | null,
  serverBlocked: boolean,
): ContextState => {
  if (serverBlocked) return "blocked";
  if (!budget) return "ok";
  if (occupancy >= budget.blockThreshold) return "blocked";
  if (occupancy >= budget.warnThreshold) return "warn";
  return "ok";
};

export const CONTEXT_COMPACTION_REQUIRED = "CONTEXT_COMPACTION_REQUIRED";
export const COMPACTION_INSUFFICIENT = "COMPACTION_INSUFFICIENT";
