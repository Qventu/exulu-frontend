// Pure helpers for the claim-check panel (spec §5, §5.1).
//
// The backend's metadata fragment is a MANIFEST — one entry per source the
// client should send, naming its `type` and the `toolCallId` that produced it
// (absent for a memory, which comes from metadata rather than a tool part).
// The evidence itself averages ~89,000 characters per turn and the client
// already holds it — in the retrieval tool's output, or in the turn's own
// `recalledMemories` — so this module assembles the request from what is
// already on the message rather than fetching anything again.
import type { UIMessage } from "ai";

import type { ClaimCheckResult, ClaimCheckSource, ClaimCheckSourceType, ScoreLabel } from "@/lib/api/claim-check";

/**
 * One manifest entry. Stable within the turn: `item_id` for a knowledge-base
 * chunk, `memory:<id>` for a recalled memory, `tool:<toolCallId>` otherwise.
 * `toolCallId` locates the part that produced it — absent only for `memory`.
 */
export type ClaimCheckManifestEntry = {
  type: ClaimCheckSourceType;
  id: string;
  toolCallId?: string;
};

export type ClaimCheckTrigger = { enabled: true; sources: ClaimCheckManifestEntry[] };

const SOURCE_TYPES = new Set<ClaimCheckSourceType>([
  "knowledge_base", "document", "memory", "web", "session_item", "other",
]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * The backend's switch. No fragment — or a fragment naming no sources — means
 * no check ever runs for this message; the frontend does not second-guess it.
 *
 * The Stage 3 shape (`sourceIds`/`toolCallIds`, no `sources` array) reads as
 * "nothing to do" rather than as an empty check: the two halves of this
 * feature deploy together, and a stray old-shaped fragment must not be
 * mistaken for a worked example of the new one. Likewise an entry of an
 * unrecognised `type`, or one missing a string `id`, is dropped rather than
 * trusted — a manifest is the backend's own output, but a value this module
 * cannot act on is not evidence this module can send.
 */
export function parseClaimCheckTrigger(metadata: unknown): ClaimCheckTrigger | null {
  if (!isRecord(metadata)) return null;
  const fragment = metadata.claimCheck;
  if (!isRecord(fragment) || fragment.enabled !== true || !Array.isArray(fragment.sources)) return null;
  const sources = fragment.sources.filter(
    (s): s is ClaimCheckManifestEntry =>
      isRecord(s) && typeof s.id === "string" && !!s.id &&
      typeof s.type === "string" && SOURCE_TYPES.has(s.type as ClaimCheckSourceType) &&
      (s.toolCallId === undefined || typeof s.toolCallId === "string"),
  );
  return sources.length > 0 ? { enabled: true, sources } : null;
}

/**
 * The AI SDK's tool-part states that mean "this turn has stopped, waiting on
 * the user". `approval-requested` is the question; `approval-responded` is
 * the answer recorded but the turn not yet resumed.
 *
 * Exactly these two, and no more. The SDK's terminal states for an answered
 * approval are `output-available` (ran) and `output-denied` (declined), so
 * neither outcome leaves a message stuck here — a declined tool resolves and
 * the resumed turn gets its check. Including `output-denied` would suppress
 * claim checking permanently for any turn in which the user said no.
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

/**
 * The tool part a manifest entry points at, found by id rather than by name —
 * the one change that makes a backend tool rename harmless to this feature.
 */
function partByToolCallId(message: UIMessage, toolCallId: string): Record<string, unknown> | undefined {
  for (const part of (message.parts ?? []) as unknown[]) {
    if (isRecord(part) && part.toolCallId === toolCallId) return part;
  }
  return undefined;
}

/** A retrieval tool call's chunks, whatever the tool is named; never throws. */
function chunksOf(part: Record<string, unknown>): Record<string, unknown>[] {
  const raw = isRecord(part.output) ? part.output.result : undefined;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed) && Array.isArray(parsed.chunks)) {
      return parsed.chunks.filter(isRecord);
    }
  } catch {
    // A truncated or offloaded output is not a reason to break the panel.
  }
  return [];
}

/**
 * A knowledge-base entry: the retrieval part named by `toolCallId`, filtered
 * to this entry's `item_id`. Several chunks of the same item are concatenated
 * so the source arrives whole — the check's containment and evidence
 * selection both read continuous text.
 */
function knowledgeBaseSource(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  if (!entry.toolCallId) return undefined;
  const part = partByToolCallId(message, entry.toolCallId);
  if (!part) return undefined;
  const mine = chunksOf(part).filter((c) => c.item_id === entry.id);
  if (mine.length === 0) return undefined;
  const name = typeof mine[0]!.item_name === "string" ? (mine[0]!.item_name as string) : undefined;
  const content = mine
    .map((c) => (typeof c.chunk_content === "string" ? c.chunk_content : ""))
    .filter(Boolean)
    .join("\n\n");
  return { id: entry.id, name, type: "knowledge_base", content };
}

/**
 * A memory entry: its text comes out of the turn's own `recalledMemories`
 * metadata — the same list the memories panel renders — never from a tool
 * part, which is why a memory entry carries no `toolCallId`. The manifest id
 * is `memory:<id>`; the metadata list's own ids have no prefix.
 */
function memorySource(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  const metadata = isRecord(message.metadata) ? message.metadata : undefined;
  const memories = Array.isArray(metadata?.recalledMemories) ? metadata.recalledMemories : [];
  const memoryId = entry.id.startsWith("memory:") ? entry.id.slice("memory:".length) : entry.id;
  const memory = memories.find((m) => isRecord(m) && m.id === memoryId);
  if (!isRecord(memory)) return undefined;
  const content = typeof memory.information === "string" ? memory.information : "";
  if (!content.trim()) return undefined;
  const name = typeof memory.title === "string" ? memory.title : undefined;
  return { id: entry.id, name, type: "memory", content };
}

/**
 * Dispatches a manifest entry to its type's handler. `document`, `web` and
 * `session_item` are added in Task F2 — until then an entry of one of those
 * types simply recovers nothing, which `collectSources`' never-invent rule
 * already handles by omitting it, exactly as it does for any other source
 * this client fails to recover.
 */
function sourceFor(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  switch (entry.type) {
    case "memory":
      return memorySource(message, entry);
    case "knowledge_base":
      return knowledgeBaseSource(message, entry);
    default:
      return undefined;
  }
}

/**
 * The named sources, with their text, in manifest order.
 *
 * Two omissions, both deliberate:
 * - A duplicated id in the manifest produces one source, not one per mention.
 * - An entry whose recovered content is empty is dropped, not emitted as
 *   `{ content: "" }`. A source with no text is indistinguishable from a
 *   fabricated one: the backend would score every claim citing it against
 *   nothing and report those claims `unsupported` — a false hallucination
 *   alarm about the user's own answer. This module's contract is never
 *   invent, never pad; the caller (`hooks.ts`) refuses the whole check when
 *   the manifest named more than this recovers.
 */
export function collectSources(message: UIMessage, manifest: ClaimCheckManifestEntry[]): ClaimCheckSource[] {
  const out: ClaimCheckSource[] = [];
  const seen = new Set<string>();
  for (const entry of manifest) {
    if (seen.has(entry.id)) continue;
    const source = sourceFor(message, entry);
    if (!source || !source.content.trim()) continue;
    seen.add(entry.id);
    out.push(source);
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
