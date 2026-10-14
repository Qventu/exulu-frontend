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

/**
 * The manifest types this client can act on. `other` is deliberately NOT
 * among them: it exists for third-party callers of POST /claims/check (the
 * backend's own types call it request-only) and `manifestFor` never emits
 * it, so an entry naming it would parse here and then fail at
 * `claimCheckRequestFor`'s coverage guard instead — two silent-refusal paths
 * for one condition, in the module whose whole rule is to fail closed in ONE
 * place.
 */
const SOURCE_TYPES = new Set<ClaimCheckSourceType>([
  "knowledge_base", "document", "memory", "web", "session_item",
]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * The backend's switch. No fragment — or a fragment naming no sources — means
 * no check ever runs for this message; the frontend does not second-guess it.
 *
 * The Stage 3 shape (`sourceIds`/`toolCallIds`, no `sources` array) reads as
 * "nothing to do" rather than as an empty check: the two halves of this
 * feature deploy together, and a stray old-shaped fragment must not be
 * mistaken for a worked example of the new one.
 *
 * An entry this client cannot validate — a non-string/missing `id`, a
 * non-string `toolCallId` when present, or a `type` outside the known set —
 * fails the WHOLE manifest closed (returns `null`) rather than being dropped
 * and the rest returned. Ruled 2026-10-14, addendum to the F1 brief: dropping
 * just that entry would leave `trigger.sources` shorter than the backend's
 * actual manifest, so `claimCheckRequestFor`'s completeness guard in
 * `hooks.ts` — which compares what this module recovers against
 * `trigger.sources` — would agree with the shrunken list and run the check
 * anyway. That verifies the answer against part of its evidence and reports
 * grounded claims `unsupported`, the exact failure every other rule in this
 * module exists to prevent. A manifest is the backend's own output, but an
 * entry this module cannot act on means the backend knows about evidence
 * this client cannot produce — the missing panel is the safe failure, not a
 * partial one.
 */
export function parseClaimCheckTrigger(metadata: unknown): ClaimCheckTrigger | null {
  if (!isRecord(metadata)) return null;
  const fragment = metadata.claimCheck;
  if (!isRecord(fragment) || fragment.enabled !== true || !Array.isArray(fragment.sources)) return null;
  const isValidEntry = (s: unknown): s is ClaimCheckManifestEntry =>
    isRecord(s) && typeof s.id === "string" && !!s.id &&
    typeof s.type === "string" && SOURCE_TYPES.has(s.type as ClaimCheckSourceType) &&
    (s.toolCallId === undefined || typeof s.toolCallId === "string");
  if (!fragment.sources.every(isValidEntry)) return null;
  const sources = fragment.sources;
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
 * A knowledge-base entry: this item's passages, pooled from **every** part of
 * the message that carries a chunk with this `item_id`, in message order and
 * concatenated — the check's containment and evidence selection both read
 * continuous text.
 *
 * Pooling across calls, rather than reading only the part named by the
 * entry's `toolCallId`, is fix round 3's Critical 3. Several retrieval calls
 * per turn are designed and normal (`max_searches`), and each call serialises
 * only its own chunks. When two searches both return item `i1` with DIFFERENT
 * passages — "voltage of the FST-2XT", then "maintenance interval of the
 * FST-2XT", same handbook — the backend names that item ONCE (it dedupes by
 * item id, first-seen wins), so reading one call's part dropped every passage
 * the other returned while the answer rested on them. The coverage guard was
 * satisfied, so the check ran and scored a grounded claim `unsupported`; the
 * endpoint's duplicate-id 400 rules out naming the item twice as a
 * workaround. Default-on `suppress_duplicate_passages` makes it likelier, not
 * rarer: it frees result slots for DIFFERENT passages of an item already
 * seen. Stage 3 pooled across every retrieval part, so this is a Stage 4
 * regression.
 *
 * `entry.toolCallId` is therefore provenance, not the lookup key — and the
 * lookup needs no tool name either, which is what Stage 4 bought: the filter
 * is `item_id === entry.id`, and a chunk carrying this item's id IS a passage
 * of this item whichever call produced it, so attribution stays correct by
 * construction. One source per item id is preserved, so
 * `evidence[].sourceId` still resolves to exactly one document.
 *
 * NOTE (fix round 3, reported to the coordinator): the brief ruled this as
 * "every part whose `toolCallId` appears on any `knowledge_base` manifest
 * entry". That set is narrower than this, and it does not fix the brief's own
 * example: a second search that returns ONLY items already named contributes
 * no manifest entry, so its call id appears nowhere and its passages stay
 * lost — which is precisely the two-searches-over-one-handbook case. Widening
 * the scan to the whole message closes that; narrowing it back is one added
 * `callIds.has(part.toolCallId)` condition.
 */
function knowledgeBaseSource(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  let name: string | undefined;
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const part of (message.parts ?? []) as unknown[]) {
    if (!isRecord(part)) continue;
    for (const chunk of chunksOf(part)) {
      if (chunk.item_id !== entry.id) continue;
      if (name === undefined && typeof chunk.item_name === "string") name = chunk.item_name;
      const text = typeof chunk.chunk_content === "string" ? chunk.chunk_content : "";
      if (!text) continue;
      // A passage both calls returned is one passage, not two: repeating it
      // adds no evidence and skews the engine's passage-level IDF.
      const key = typeof chunk.chunk_id === "string" ? chunk.chunk_id : text;
      if (seen.has(key)) continue;
      seen.add(key);
      texts.push(text);
    }
  }
  if (texts.length === 0) return undefined;
  return { id: entry.id, name, type: "knowledge_base", content: texts.join("\n\n") };
}

/**
 * A memory entry: its text comes out of the turn's own `recalledMemories`
 * metadata — the same list the memories panel renders — never from a tool
 * part, which is why a memory entry carries no `toolCallId`. The manifest id
 * is `memory:<id>`; the metadata list's own ids have no prefix.
 *
 * With blank `information` the content falls back to the TITLE (fix round 3,
 * Important 5). The prompt block the model read is
 * `- {item_name: "<title>", item_id: …} <information> (saved by …)`
 * (backend `buildMemoryPromptBlock`), so a title-only row — an ordinary
 * shape for a hand-created memory — is still real evidence in the system
 * prompt. Dropping it discarded evidence the model was shown, and a claim
 * resting on it then scored `unsupported`.
 *
 * A blank title normalises to `undefined` here, at the source, rather than
 * leaning on the two downstream falsiness checks (the message column's
 * `source.name &&` and the panel's `name ?`): an empty string is no name.
 */
function memorySource(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  const metadata = isRecord(message.metadata) ? message.metadata : undefined;
  const memories = Array.isArray(metadata?.recalledMemories) ? metadata.recalledMemories : [];
  const memoryId = entry.id.startsWith("memory:") ? entry.id.slice("memory:".length) : entry.id;
  const memory = memories.find((m) => isRecord(m) && m.id === memoryId);
  if (!isRecord(memory)) return undefined;
  const information = typeof memory.information === "string" ? memory.information : "";
  const title = typeof memory.title === "string" && memory.title.trim() ? memory.title : undefined;
  const content = information.trim() ? information : (title ?? "");
  if (!content.trim()) return undefined;
  return { id: entry.id, name: title, type: "memory", content };
}

/**
 * `read_session_file` and `parse_document` both answer `{ content, … }` on
 * success and `{ error }` on failure, so one arm serves both. The error
 * branch matters: an error string is not evidence, and sending it would have
 * the check verify the answer against a failure message.
 */
function documentSource(part: Record<string, unknown>, entry: ClaimCheckManifestEntry): ClaimCheckSource | undefined {
  const output = isRecord(part.output) ? part.output : undefined;
  const content = typeof output?.content === "string" ? output.content : "";
  if (!content.trim()) return undefined;
  const input = isRecord(part.input) ? part.input : undefined;
  const name = typeof input?.filename === "string" ? input.filename : undefined;
  return { id: entry.id, name, type: "document", content };
}

/**
 * The backend's `internet_search` replaces every `[n]` marker in Perplexity's
 * prose with `JSON.stringify({ url, title, snippet })` of `search_results[n-1]`
 * (`src/templates/tools/perplexity.ts`), so the body the model read carries
 * citation JSON where a reader expects `[1]`. Rebuilding that exact string per
 * index — same keys, same order, same `undefined`-dropping — and putting the
 * marker back is what keeps an evidence quote shown under a verdict from
 * being a `{"url":…}` blob.
 *
 * Unmatched blobs are left alone rather than scrubbed by a loose regex: the
 * substitution only happens when `search_results[index]` exists, so a blob
 * with no match is text the model genuinely received.
 */
function restoreCitationMarkers(body: string, results: unknown[]): string {
  let out = body;
  results.forEach((r, i) => {
    if (!isRecord(r)) return;
    const blob = JSON.stringify({ url: r.url, title: r.title, snippet: r.snippet });
    if (!out.includes(blob)) return;
    out = out.split(blob).join(`[${i + 1}]`);
  });
  return out;
}

/**
 * Perplexity answers `{ result: JSON.stringify({ content, citations,
 * search_results }) }`.
 *
 * `content` is the prose answer — **the text the assistant paraphrased** —
 * and each `search_results[i].snippet` is a sentence or two from one page. So
 * the body is sent ALWAYS, as its own source named for the search, and each
 * cited page is sent as well so a verdict can still cite the page it came
 * from. Sending only the snippets (the Stage 4 shape, fix round 3 Critical 1)
 * scores a claim that paraphrases the body but appears in no snippet
 * `unsupported` — a false "your answer was unfounded" on an ordinary search
 * turn, which is the exact failure this feature exists to prevent. Extra
 * sources cost no model calls: `evidence.ts` selects the top passages per
 * claim (spec §7).
 *
 * Perplexity's synthesis counting as evidence is deliberate, not an
 * oversight: spec §2 rules out trust tiers, and the engine checks grounding
 * in the evidence the model was given, not truth.
 *
 * The body keeps the bare `entry.id`; the per-page ids are namespaced
 * `${entry.id}#<index>` so several sources can come from one manifest entry.
 */
function webSources(part: Record<string, unknown>, entry: ClaimCheckManifestEntry): ClaimCheckSource[] {
  const output = isRecord(part.output) ? part.output : undefined;
  if (typeof output?.result !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.result);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  const results = Array.isArray(parsed.search_results) ? parsed.search_results : [];
  const cited = results.flatMap((r, i) => {
    if (!isRecord(r)) return [];
    const url = typeof r.url === "string" ? r.url : undefined;
    const title = typeof r.title === "string" ? r.title : undefined;
    const snippet = typeof r.snippet === "string" ? r.snippet : "";
    const content = [title, snippet].filter(Boolean).join("\n\n");
    if (!content.trim()) return [];
    // `title ?? url`: the panel renders a name as prose beside a quote
    // ("Webseite – Anlagen A: „230 Volt“"), where a bare URL reads worse
    // than a headline.
    return [{ id: `${entry.id}#${i}`, name: title ?? url, type: "web" as const, content }];
  });
  const raw = typeof parsed.content === "string" ? parsed.content : "";
  const body = raw.trim() ? restoreCitationMarkers(raw, results) : "";
  const input = isRecord(part.input) ? part.input : undefined;
  const query = typeof input?.query === "string" && input.query.trim() ? input.query : undefined;
  const answer: ClaimCheckSource[] = body.trim()
    ? [{ id: entry.id, name: query, type: "web", content: body }]
    : [];
  return [...answer, ...cited];
}

/**
 * Session-items search answers `{ result: JSON.stringify(results.flat()) }`
 * where `results` holds one `context.search(...)` call per context
 * referenced in the session (`session-items-retrieval-tool.ts`, backend
 * repo).
 *
 * Measured, not guessed: `context.search` (`src/exulu/context.ts`) forwards
 * to `vectorSearch` (`src/graphql/resolvers/vector-search.ts`), whose return
 * type is a WHOLE per-context response — `{ itemFilters, chunkFilters,
 * query, keywords, method, context: { name, id, embedder }, chunks:
 * VectorSearchChunkResult[], entityInsights? }` — not a bare chunk. So each
 * element of the flattened array nests its chunks one level deeper than the
 * knowledge-base tool's output: `element.chunks[].item_id` /
 * `.item_name` / `.chunk_content`, not `element.item_id` directly. A context
 * with no embedder configured contributes a bare string (its
 * "embedder not configured" message, returned by the tool's own catch
 * branch) instead of a response object; that string is not retrieved
 * evidence and is skipped like any other non-object element.
 *
 * One source per item, its chunks joined — same grouping as the
 * knowledge-base arm — so a quote is attributable to a file rather than to a
 * fragment number. Ids are namespaced `${entry.id}#<itemId>`.
 */
function sessionItemSources(part: Record<string, unknown>, entry: ClaimCheckManifestEntry): ClaimCheckSource[] {
  const output = isRecord(part.output) ? part.output : undefined;
  if (typeof output?.result !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.result);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const byItem = new Map<string, { name?: string; chunks: string[] }>();
  for (const el of parsed) {
    if (!isRecord(el)) continue; // the embedder-not-configured error string
    const chunks = Array.isArray(el.chunks) ? el.chunks : [];
    for (const row of chunks) {
      if (!isRecord(row) || typeof row.item_id !== "string") continue;
      const text = typeof row.chunk_content === "string" ? row.chunk_content : "";
      if (!text.trim()) continue;
      const bucket = byItem.get(row.item_id) ?? { name: typeof row.item_name === "string" ? row.item_name : undefined, chunks: [] };
      bucket.chunks.push(text);
      byItem.set(row.item_id, bucket);
    }
  }
  return [...byItem].map(([itemId, { name, chunks }]) => ({
    id: `${entry.id}#${itemId}`,
    name,
    type: "session_item" as const,
    content: chunks.join("\n\n"),
  }));
}

/**
 * Dispatches a manifest entry to its type's handler(s). Every arm returns an
 * array so a `web` or `session_item` entry can legitimately yield several
 * sources (a web search cites several pages; a session item has several
 * chunks) without a separate code path.
 */
function sourceFor(message: UIMessage, entry: ClaimCheckManifestEntry): ClaimCheckSource[] {
  switch (entry.type) {
    case "memory": {
      const source = memorySource(message, entry);
      return source ? [source] : [];
    }
    case "knowledge_base": {
      const source = knowledgeBaseSource(message, entry);
      return source ? [source] : [];
    }
    case "document":
    case "web":
    case "session_item": {
      if (!entry.toolCallId) return [];
      const part = partByToolCallId(message, entry.toolCallId);
      if (!part) return [];
      if (entry.type === "document") {
        const source = documentSource(part, entry);
        return source ? [source] : [];
      }
      return entry.type === "web" ? webSources(part, entry) : sessionItemSources(part, entry);
    }
    default:
      return [];
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
    const sources = sourceFor(message, entry).filter((s) => s.content.trim());
    if (sources.length === 0) continue;
    seen.add(entry.id);
    out.push(...sources);
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
