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
 */
export function collectSources(message: UIMessage, sourceIds: string[]): ClaimCheckSource[] {
  const chunks = chunksOf(message);
  const out: ClaimCheckSource[] = [];
  for (const id of sourceIds) {
    const mine = chunks.filter((c) => c.item_id === id);
    if (mine.length === 0) continue;
    const name = typeof mine[0]!.item_name === "string" ? (mine[0]!.item_name as string) : undefined;
    const content = mine
      .map((c) => (typeof c.chunk_content === "string" ? c.chunk_content : ""))
      .filter(Boolean)
      .join("\n\n");
    out.push(name ? { id, name, content } : { id, content });
  }
  return out;
}

/**
 * The answer exactly as the check must see it: the text parts joined in order.
 * `sentences[].start/end` index into THIS string, so any transformation here
 * would silently move every highlight. Parts can be split by an interrupting
 * tool call rather than by a real paragraph break, so this concatenates raw —
 * unlike `messageMarkdown` in `components/message-renderer.tsx`, which joins
 * with blank lines for display/copy readability. Same source parts, two
 * different purposes: this one must agree with what the backend segmented.
 */
export function answerTextOf(message: UIMessage): string {
  return ((message.parts ?? []) as unknown[])
    .filter((p): p is { type: "text"; text: string } => isRecord(p) && p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
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
