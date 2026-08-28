/**
 * Pure data helpers for message-renderer.tsx (kept JSX-free so they run under
 * the node vitest environment).
 *
 * Motivation (chat streaming freeze): the AI SDK deep-clones the in-progress
 * assistant message on every throttled stream tick (`ReactChatState.snapshot`
 * → structuredClone), so tool-part OBJECT REFERENCES are new each tick even
 * when their content is final. The legacy renderer re-ran JSON.parse over
 * every tool part's output (often entire file contents) on every tick — twice
 * for generic tool parts. These helpers normalize a tool part's output ONCE
 * and cache the result keyed by toolCallId + state: a part that reached a
 * terminal state is immutable, so its parsed form never needs recomputing.
 */

import type { DynamicToolUIPart } from "ai";

import type { ImageGenerationWidgetConfig } from "@/components/image-generation/image-generation-widget";
import { formatRetrievalMetrics } from "@/lib/retrieval-metrics";
import type { KnowledgeSourceSearchResultChunk } from "@/types/models/knowledge-source-search-results";

export interface ItemWithChunks {
  id: string;
  external_id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  context: {
    name: string;
    id: string;
  };
  chunks: KnowledgeSourceSearchResultChunk[];
}

export interface ToolReasoningStep {
  text: string;
  tools: {
    name: string;
    id: string;
    input: any;
    output: any;
  }[];
}

/** Once a tool part reaches one of these states its content never changes. */
export const TERMINAL_TOOL_STATES = new Set<string>([
  "output-available",
  "output-error",
  "output-denied",
]);

export type ToolDataCache = Map<string, { state: string; value: unknown }>;

/**
 * Returns the cached value for `key` when the part is still in the same
 * (terminal) state; otherwise computes it, caching only terminal states —
 * a part still streaming its input/output must be recomputed each tick.
 */
export function getCachedToolData<T>(
  cache: ToolDataCache,
  key: string,
  state: string | undefined,
  compute: () => T,
): T {
  const hit = cache.get(key);
  if (hit && hit.state === state) return hit.value as T;
  const value = compute();
  if (state && TERMINAL_TOOL_STATES.has(state)) {
    cache.set(key, { state, value });
  }
  return value;
}

export interface ContextSearchData {
  items: ItemWithChunks[];
  contextNames: string;
  totalChunks: number;
  reasoning: ToolReasoningStep[] | undefined;
  metricsLine: string | null;
}

/**
 * Normalizes a context_search tool part's output into the grouped shape the
 * renderer displays. Returns null when the output is unusable (render
 * nothing — same as the legacy branch's bail on an unparseable `result`).
 */
export function computeContextSearchData(part: {
  output?: unknown;
}): ContextSearchData | null {
  let output: any = part.output;
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch {
      return null;
    }
  }
  let result: any = output?.result;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      return null;
    }
  }

  const chunks: KnowledgeSourceSearchResultChunk[] | undefined = Array.isArray(
    result,
  )
    ? result
    : result?.chunks;
  const reasoning: ToolReasoningStep[] | undefined = Array.isArray(result)
    ? []
    : result?.reasoning;
  const metricsLine = formatRetrievalMetrics(
    Array.isArray(result) ? undefined : result?.metrics,
  );

  const itemsMap = new Map<string, ItemWithChunks>();
  const uniqueContexts = new Set(
    chunks?.map((chunk) =>
      chunk.context?.name ? chunk.context.name.replaceAll("_", " ") : "",
    ),
  );
  const contextNames = Array.from(uniqueContexts).join(", ");
  if (chunks) {
    for (const chunk of chunks) {
      if (itemsMap.has(chunk.item_id)) {
        itemsMap.get(chunk.item_id)?.chunks.push(chunk);
      } else {
        itemsMap.set(chunk.item_id, {
          id: chunk.item_id,
          updatedAt: chunk.item_updated_at,
          createdAt: chunk.item_created_at,
          external_id: chunk.item_external_id,
          name: chunk.item_name,
          context: {
            name: chunk.context?.name,
            id: chunk.context?.id,
          },
          chunks: [chunk],
        });
      }
    }
  }

  return {
    items: Array.from(itemsMap.values()),
    contextNames,
    totalChunks: chunks?.length ?? 0,
    reasoning,
    metricsLine,
  };
}

export interface UntypedToolData {
  /**
   * false when `output.result` is a string that is not valid JSON — the
   * legacy untyped branch rendered nothing for that case.
   */
  ok: boolean;
  /**
   * The part to hand to the tool renderer. When `output` is an object whose
   * `result` was a JSON string, this carries the parsed `result` — the legacy
   * code mutated `part.output.result` in place to the same effect; here the
   * part is copied instead. Otherwise it is the input part unchanged.
   */
  part: DynamicToolUIPart;
  reasoning: ToolReasoningStep[] | undefined;
  metricsLine: string | null;
  /** Set when the result is an image_generation_widget payload. */
  imageWidget?: ImageGenerationWidgetConfig;
  /** Set when the result is a legacy inline image_generation payload. */
  imageInline?: {
    url: string;
    prompt?: string;
    revisedPrompt?: string;
    model?: string;
  };
}

/**
 * Single normalization pass for a generic (`tool-*` / dynamic) tool part —
 * replaces the legacy double parse (image-shape check + untyped branch).
 */
export function computeUntypedToolData(
  part: DynamicToolUIPart,
): UntypedToolData {
  const base: UntypedToolData = {
    ok: true,
    part,
    reasoning: undefined,
    metricsLine: null,
  };

  let output: any = part.output;
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch {
      // Non-JSON string output: render the raw string as-is.
      return base;
    }
  }

  // Auth short-circuits (tool-credentials spec 2026-07-22 §2.2): the oauth
  // variant carries model-facing text in `result` (not JSON) and the
  // credentialRequest variant carries result: null — both must reach the
  // untyped tool renderer, which owns the connect/credential cards. Without
  // this guard the oauth text falls into the unparseable-result ok=false
  // branch below and nothing renders.
  if (
    output &&
    typeof output === "object" &&
    (output.credentialRequest || output.oauth?.authorizationUrl)
  ) {
    return base;
  }

  let result: any = output?.result;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      // A non-JSON `result` renders as raw text, exactly as a non-JSON
      // `output` already does thirty lines above. It used to return ok:false,
      // which the caller turns into `return null` — the tool block vanished.
      //
      // The asymmetry was legacy behaviour rather than a decision, and it had
      // already been patched around once: the oauth/credential guard above
      // exists because that text is also non-JSON and "nothing renders".
      //
      // What it costs in practice: a tool whose result is a plain status
      // string is visible while it runs — no output yet, so nothing to fail to
      // parse — and disappears at the moment it succeeds. Newlift's memory
      // writes return "Created Newton Memory Item with the following ID: …",
      // so every remembered fact vanished from the transcript on success,
      // which is the opposite of the transparency the feature is for.
      //
      // Only affects tool calls that currently render NOTHING, so no output a
      // user sees today changes; things they could not see become visible.
      return base;
    }
  }

  if (
    result &&
    typeof result === "object" &&
    result.type === "image_generation_widget"
  ) {
    return { ...base, imageWidget: result as ImageGenerationWidgetConfig };
  }
  if (
    result &&
    typeof result === "object" &&
    result.type === "image_generation" &&
    typeof result.url === "string"
  ) {
    return {
      ...base,
      imageInline: {
        url: result.url,
        prompt: result.prompt,
        revisedPrompt: result.revised_prompt,
        model: result.model,
      },
    };
  }

  // Legacy parity: only when `output` IS the part's own output object did the
  // old code mutate `output.result` to the parsed value before rendering.
  let partForRender = part;
  if (
    output &&
    typeof output === "object" &&
    output === part.output &&
    "result" in output &&
    result !== output.result
  ) {
    partForRender = {
      ...part,
      output: { ...output, result },
    } as DynamicToolUIPart;
  }

  const reasoning: ToolReasoningStep[] | undefined = Array.isArray(result)
    ? []
    : result?.reasoning;
  const metricsLine = formatRetrievalMetrics(
    Array.isArray(result) ? undefined : result?.metrics,
  );

  return { ok: true, part: partForRender, reasoning, metricsLine };
}

/**
 * Custom React.memo comparator for MessageItem.
 *
 * - Function props are skipped: handlers are recreated by the chat surface on
 *   every stream tick, but every handler passed down either only touches
 *   stable/ref-backed state or is re-captured whenever this item's data props
 *   change (see message-renderer.tsx).
 * - Component-type props (UntypedToolPartComponent, AgentVisualComponent) ARE
 *   compared — swapping a component type must remount the subtree.
 * - `config` is compared by its two known fields since call sites pass it as
 *   an inline object literal.
 * - Everything else compares by Object.is; finished messages keep their
 *   object identity across stream ticks (the SDK only clones the message it
 *   replaces), so this bails out for all but the streaming message.
 */
const COMPARED_FUNCTION_PROPS = new Set([
  "UntypedToolPartComponent",
  "AgentVisualComponent",
]);

export function messageItemPropsEqual(
  prev: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): boolean {
  for (const key of Object.keys(next)) {
    const prevValue = prev[key];
    const nextValue = next[key];
    if (
      typeof nextValue === "function" &&
      typeof prevValue === "function" &&
      !COMPARED_FUNCTION_PROPS.has(key)
    ) {
      continue;
    }
    if (key === "config") {
      const p = (prevValue ?? {}) as Record<string, unknown>;
      const n = (nextValue ?? {}) as Record<string, unknown>;
      if (
        p.marginTopFirstMessage !== n.marginTopFirstMessage ||
        p.customAssistantClassnames !== n.customAssistantClassnames
      ) {
        return false;
      }
      continue;
    }
    if (!Object.is(prevValue, nextValue)) {
      return false;
    }
  }
  return true;
}
