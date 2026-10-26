/**
 * Collapses runs of identical consecutive tool parts into one render unit.
 *
 * WHY: the model fans a read tool out in parallel — session 131113e2 issued 20
 * `jira_get_issue` calls in a single step. The AI SDK gives each call its own
 * approval id and `lastAssistantMessageIsCompleteWithApprovalResponses` refuses
 * to resume the stream until *every* pending approval in the last step has been
 * answered, so the user had to click 20 approval cards, then scroll past 20
 * "Completed" cards. Pre-approval ("Allow for this chat") cannot help: the
 * server evaluates `needsApproval` for all N calls before any round-trip.
 *
 * This module is the single, pure grouping pass. It decides grouping from part
 * *types* only. Output-shape special cases (image widgets, credential/oauth
 * payloads) are the group renderer's problem — it inspects its members and
 * falls back to per-part rendering — which keeps this module free of any
 * dependency on route-local extractors.
 */

/**
 * Tool types with a bespoke renderer that runs *before* the generic
 * collapsed-tool branch. Grouping them would swallow that renderer.
 * Compared lowercased, mirroring the renderer's own `toLowerCase()` checks.
 *
 * This list is exhaustive by obligation, not by construction: a tool type that
 * grows a bespoke renderer and is not added here silently loses it, because
 * grouping happens before the renderer ever sees the part. The memory types
 * are the worked example — they arrived after this list did. `tool-memory_*`
 * parts render as MemoryCard, which deliberately REPLACES the generic approval
 * card: the card itself is the consent, with no "Allow for this chat". A
 * collapsed group would hand a memory write exactly the affordance the memory
 * design removed, and consecutive pending `memory_remember` parts would lose
 * their own "Save all" stack (groupRememberParts) on top of that.
 */
export const GROUPING_EXCLUDED_TOOL_TYPES = [
  "tool-todo_write",
  "tool-todo_read",
  "tool-question_ask",
  "tool-memory_remember",
  "tool-memory_update",
  "tool-memory_forget",
] as const;

const EXCLUDED = new Set<string>(GROUPING_EXCLUDED_TOOL_TYPES);

/**
 * A part list entry to render: either a single part (rendered exactly as
 * before) or a run of same-type tool parts to render as one card.
 */
export type RenderUnit<TPart = unknown> =
  | { kind: "part"; part: TPart; index: number }
  | { kind: "tool-group"; type: string; parts: TPart[]; startIndex: number }
  /**
   * A run of ≥2 consecutive tool calls of ANY groupable types, spanning
   * step boundaries — the sequential agent loop (Bash, then a Hubspot list,
   * then four Hubspot reads, one per step). `parts` are the calls in order;
   * the absorbed `step-start` parts render nothing anyway. startIndex /
   * endIndex are the run's bounds in the original part list.
   */
  | { kind: "tool-trace"; parts: TPart[]; startIndex: number; endIndex: number };

/**
 * True when a part may take part in a group. `dynamic-tool` is deliberately
 * excluded: its `type` is the same string for every tool, so identical types
 * would not imply identical tools and unrelated calls would merge.
 */
const isGroupableToolPart = (part: unknown): boolean => {
  const type = (part as { type?: unknown } | null)?.type;
  if (typeof type !== "string") return false;
  if (!type.startsWith("tool-")) return false;
  const lower = type.toLowerCase();
  if (EXCLUDED.has(lower)) return false;
  // Any context_search variant (agentic_context_search, …) renders through
  // ContextSearchResults; the renderer matches it by substring, so do the same.
  if (lower.includes("context_search")) return false;
  return true;
};

/**
 * Groups runs of ≥2 consecutive parts that share an identical groupable tool
 * type. Anything else — including a lone tool call — passes through as a
 * `part` unit, so its rendering is bit-for-bit what it was before.
 *
 * A `step-start`, a text part, or any other interleaved part ends a run, which
 * is what keeps groups inside a single assistant step.
 */
export function groupRenderUnits<TPart>(
  parts: readonly TPart[] | null | undefined,
): RenderUnit<TPart>[] {
  if (!parts || parts.length === 0) return [];

  const units: RenderUnit<TPart>[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    if (!isGroupableToolPart(part)) {
      units.push({ kind: "part", part, index: i });
      i += 1;
      continue;
    }

    const type = (part as { type: string }).type;
    let end = i + 1;
    while (end < parts.length && (parts[end] as { type?: unknown })?.type === type) {
      end += 1;
    }

    const runLength = end - i;
    if (runLength === 1) {
      units.push({ kind: "part", part, index: i });
    } else {
      units.push({
        kind: "tool-group",
        type,
        parts: parts.slice(i, end) as TPart[],
        startIndex: i,
      });
    }
    i = end;
  }

  return units;
}

/**
 * Second pass: drops any group whose members cannot all render inside one
 * collapsed card, splitting it back into individual `part` units at their
 * original indices — so the caller's per-part path handles them exactly as it
 * did before grouping existed.
 *
 * Separate from `groupRenderUnits` because the reasons a member opts out are
 * output-shape reasons (an image widget, an auth short-circuit) that only the
 * caller can test; keeping them out here is what leaves this module pure.
 *
 * `isGroupable` receives the part's absolute index in the original list, so a
 * caller keyed on that index (a parse cache, say) can reuse its entries.
 */
export function expandUngroupableUnits<TPart>(
  units: readonly RenderUnit<TPart>[],
  isGroupable: (part: TPart, index: number) => boolean,
): RenderUnit<TPart>[] {
  const expanded: RenderUnit<TPart>[] = [];

  for (const unit of units) {
    if (unit.kind !== "tool-group") {
      expanded.push(unit);
      continue;
    }
    // `every` short-circuits, so one failing member spares the rest the check.
    if (unit.parts.every((part, offset) => isGroupable(part, unit.startIndex + offset))) {
      expanded.push(unit);
      continue;
    }
    unit.parts.forEach((part, offset) => {
      expanded.push({ kind: "part", part, index: unit.startIndex + offset });
    });
  }

  return expanded;
}

const isStepStart = (part: unknown): boolean =>
  (part as { type?: unknown } | null)?.type === "step-start";

/**
 * True when a part may sit inside a trace. Same bespoke-renderer exclusions as
 * `isGroupableToolPart`, PLUS `dynamic-tool` (a trace never relies on type
 * identity, so the shared type is harmless) and MINUS anything mid-approval:
 * the approval card is interactive and must stay where the user can act on
 * it, so a pending call splits the run around itself.
 */
const isTraceableToolPart = (part: unknown): boolean => {
  const type = (part as { type?: unknown } | null)?.type;
  if (typeof type !== "string") return false;
  if (type !== "dynamic-tool") {
    if (!type.startsWith("tool-")) return false;
    const lower = type.toLowerCase();
    if (EXCLUDED.has(lower)) return false;
    if (lower.includes("context_search")) return false;
  }
  const state = (part as { state?: unknown }).state;
  return state !== "approval-requested" && state !== "approval-responded";
};

/**
 * Third pass, over the output of the two above: collapses a run of ≥2
 * consecutive tool calls — any mix of tools, across `step-start` boundaries,
 * same-type groups flattened in — into ONE `tool-trace` unit.
 *
 * WHY: the same-type grouping handles the parallel fan-out, but a sequential
 * agent loop issues one call per step, so eight calls meant eight stacked
 * "Completed" cards before the answer. A text or reasoning part (anything the
 * user should read in place) ends the run; so does a call awaiting approval
 * or one whose output needs its own renderer (`isGroupable`, same contract
 * as `expandUngroupableUnits`). A run of one call is emitted exactly as it
 * came in, so a lone call renders bit-for-bit as before.
 */
export function traceRenderUnits<TPart>(
  units: readonly RenderUnit<TPart>[],
  isGroupable: (part: TPart, index: number) => boolean,
): RenderUnit<TPart>[] {
  const out: RenderUnit<TPart>[] = [];
  let run: RenderUnit<TPart>[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const calls: TPart[] = [];
    for (const unit of run) {
      if (unit.kind === "tool-group") calls.push(...unit.parts);
      else if (unit.kind === "part" && !isStepStart(unit.part)) calls.push(unit.part);
    }
    if (calls.length >= 2) {
      const first = run[0];
      const last = run[run.length - 1];
      const startIndex = first.kind === "part" ? first.index : first.kind === "tool-group" ? first.startIndex : first.startIndex;
      const endIndex =
        last.kind === "part"
          ? last.index
          : last.kind === "tool-group"
            ? last.startIndex + last.parts.length - 1
            : last.endIndex;
      out.push({ kind: "tool-trace", parts: calls, startIndex, endIndex });
    } else {
      out.push(...run);
    }
    run = [];
  };

  for (const unit of units) {
    if (unit.kind === "tool-group") {
      if (unit.parts.every((part, offset) => isTraceableToolPart(part) && isGroupable(part, unit.startIndex + offset))) {
        run.push(unit);
      } else {
        flush();
        out.push(unit);
      }
      continue;
    }
    if (unit.kind === "tool-trace") {
      // Already traced (a caller running the pass twice) — keep as is.
      flush();
      out.push(unit);
      continue;
    }
    if (isStepStart(unit.part) || (isTraceableToolPart(unit.part) && isGroupable(unit.part, unit.index))) {
      run.push(unit);
      continue;
    }
    flush();
    out.push(unit);
  }
  flush();

  return out;
}
