// Pure helpers for the claim-check panel (spec §5, §5.1).
//
// The backend's metadata fragment names source IDS ONLY — the evidence itself
// averages ~89,000 characters per turn and the client already holds it in the
// retrieval tool's output, so this module assembles the request from what is
// already on the message rather than fetching anything again.
import type { UIMessage } from "ai";

import type { ClaimCheckResult, ClaimCheckSource, ScoreLabel } from "@/lib/api/claim-check";

export type ClaimCheckTrigger = { enabled: true; sourceIds: string[]; toolCallIds: string[] };

// The assistant message's retrieval part type. The backend derives this key as
// `tool-${sanitizeToolName(AGENTIC_RETRIEVAL_TOOL_NAME)}` from the one literal
// "Context Search" in its retrieval pipeline. Separate repos cannot share that
// constant, so this is the one place the name is duplicated. Keep the test
// below that pins the literal, so a rename shows up as a failing test here
// rather than as panels that silently stop appearing.
const RETRIEVAL_PART_TYPES = new Set(["tool-Context_Search"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * The backend's switch. No fragment — or a fragment naming no sources — means
 * no check ever runs for this message; the frontend does not second-guess it.
 */
export function parseClaimCheckTrigger(metadata: unknown): ClaimCheckTrigger | null {
  if (!isRecord(metadata) || !isRecord(metadata.claimCheck)) return null;
  const fragment = metadata.claimCheck;
  if (fragment.enabled !== true) return null;
  const sourceIds = Array.isArray(fragment.sourceIds)
    ? fragment.sourceIds.filter((v): v is string => typeof v === "string")
    : [];
  if (sourceIds.length === 0) return null;
  const toolCallIds = Array.isArray(fragment.toolCallIds)
    ? fragment.toolCallIds.filter((v): v is string => typeof v === "string")
    : [];
  return { enabled: true, sourceIds, toolCallIds };
}

/**
 * The AI SDK's tool-part states that mean "this turn has stopped, waiting on
 * the user". `approval-requested` is the question; `approval-responded` is
 * the answer recorded but the turn not yet resumed.
 */
const PAUSED_TOOL_STATES = new Set(["approval-requested", "approval-responded"]);

/**
 * True while this assistant message is a turn paused on a tool approval —
 * i.e. an answer that is not finished even though the SDK says `ready`.
 *
 * When a turn stops to ask for approval, the backend emits `finish` (carrying
 * the claim-check trigger, if retrieval already ran) and the SDK sets
 * `status: "ready"`. A fire effect keyed on `streaming -> ready` alone
 * therefore pays for a check of the HALF-answer. Worse, the user then
 * approves and the SDK continues **the same assistant message id**, so the
 * fired-set blocks the real check on the second `streaming -> ready`: the
 * panel under the complete answer shows a score computed over its first
 * fragment, with `status: "ok"` and no incompleteness marker, and a claim
 * whose supporting retrieval happened after the pause can read
 * `unsupported` — the worst output this system can produce (spec §2.4). The
 * stored row makes it permanent, and the endpoint's cache is keyed on
 * (session, messageId, user), so even a re-fire would return the stale
 * partial. `useChatSession` configures
 * `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`,
 * so this flow is live for any agent pairing knowledge search with an
 * approval-gated tool.
 */
export function hasPendingToolApproval(message: UIMessage): boolean {
  for (const part of (message.parts ?? []) as unknown[]) {
    if (isRecord(part) && typeof part.state === "string" && PAUSED_TOOL_STATES.has(part.state)) {
      return true;
    }
  }
  return false;
}

/** Every retrieved chunk on this message, flattened; never throws. */
function chunksOf(message: UIMessage): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const part of (message.parts ?? []) as unknown[]) {
    if (!isRecord(part) || typeof part.type !== "string" || !RETRIEVAL_PART_TYPES.has(part.type)) continue;
    const raw = isRecord(part.output) ? part.output.result : undefined;
    if (typeof raw !== "string") continue;
    try {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed) && Array.isArray(parsed.chunks)) {
        for (const chunk of parsed.chunks) if (isRecord(chunk)) out.push(chunk);
      }
    } catch {
      // A truncated or offloaded output is not a reason to break the panel.
    }
  }
  return out;
}

/**
 * The named sources, with their text, in the order the metadata named them.
 * Several chunks of one document are concatenated so the source arrives whole —
 * the check's containment and evidence selection both read continuous text.
 *
 * Two omissions, both deliberate:
 * - A duplicated id in the fragment produces one source, not one per mention.
 * - An id whose chunks are all missing or empty `chunk_content` is dropped,
 *   not emitted as `{ content: "" }`. A source with no text is indistinguishable
 *   from a fabricated one: the backend would score every claim citing it
 *   against nothing and report those claims `unsupported` — a false
 *   hallucination alarm about the user's own answer. This module's contract is
 *   never invent, never pad; the caller (Task F4) is responsible for refusing
 *   to run a check whose evidence came back incomplete.
 */
export function collectSources(message: UIMessage, sourceIds: string[]): ClaimCheckSource[] {
  const chunks = chunksOf(message);
  const out: ClaimCheckSource[] = [];
  for (const id of [...new Set(sourceIds)]) {
    const mine = chunks.filter((c) => c.item_id === id);
    if (mine.length === 0) continue;
    const name = typeof mine[0]!.item_name === "string" ? (mine[0]!.item_name as string) : undefined;
    const content = mine
      .map((c) => (typeof c.chunk_content === "string" ? c.chunk_content : ""))
      .filter(Boolean)
      .join("\n\n");
    if (!content) continue;
    out.push(name ? { id, name, content } : { id, content });
  }
  return out;
}

/**
 * The answer exactly as the check must see it: the text parts joined with
 * blank lines, matching `messageMarkdown` in `components/message-renderer.tsx`
 * — the two must stay in sync. Two reasons: the string we check should be the
 * string the user actually read (what the renderer displays and copy produces),
 * and a raw join can fuse two sentences across a tool-call interruption —
 * "...230 Volt." + "Sie braucht..." becomes "...230 Volt.Sie braucht...", and
 * the backend's `Intl.Segmenter` needs whitespace after the period to see two
 * sentences there, not one. `sentences[].start/end` index into THIS string, so
 * a join mismatch here silently moves every highlight.
 */
export function answerTextOf(message: UIMessage): string {
  return ((message.parts ?? []) as unknown[])
    .filter((p): p is { type: "text"; text: string } => isRecord(p) && p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n\n");
}

export function summarise(result: ClaimCheckResult): {
  checked: number;
  supported: number;
  contradicted: number;
  unsupported: number;
  label: ScoreLabel;
  partial: boolean;
} {
  return {
    checked: result.score.claims,
    supported: result.score.supported,
    contradicted: result.score.contradicted,
    unsupported: result.score.unsupported,
    label: result.score.label,
    partial: result.status === "partial",
  };
}
