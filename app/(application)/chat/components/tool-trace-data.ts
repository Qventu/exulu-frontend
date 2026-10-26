/**
 * Pure logic behind the tool-trace card (tool-trace.tsx): the sequential
 * agent loop — one tool per step, eight steps before the answer — folded
 * into one card. Mirrors tool-call-group-data.ts (parallel fan-out) and keeps
 * to the repo's pure-module test convention: no React, no fetch.
 */
import type { DynamicToolUIPart, ToolUIPart } from "ai";

import { aggregateToolState } from "./tool-call-group-data";

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Raw tool name: "tool-hubspot_read" → "hubspot_read"; dynamic → toolName. */
export const rawToolName = (part: {
  type: string;
  toolName?: string;
}): string =>
  part.type === "dynamic-tool"
    ? (part.toolName ?? "tool")
    : part.type.replace(/^tool-/, "");

/**
 * Display name, derived exactly like the single-call card and the grouped
 * card ("Hubspot list tools"), so a lone call and a trace step read the same.
 */
export const formatToolName = (part: {
  type: string;
  toolName?: string;
}): string =>
  capitalize(rawToolName(part).replace(/ /g, "-").replace(/_/g, " "));

export interface ToolTraceStep {
  /** Display name (formatToolName). */
  name: string;
  /** Raw tool name, for the demo's German labels (toolLabel). */
  raw: string;
  /** Consecutive calls of this tool folded into the step. */
  count: number;
  /** Worst state across the folded calls (aggregateToolState order). */
  state: ToolUIPart["state"];
}

export interface ToolTraceSummary {
  /** One state for the card header — the whole run rolled up. */
  state: ToolUIPart["state"];
  errorCount: number;
  /** The run as the user reads it: consecutive same-tool calls collapsed. */
  sequence: ToolTraceStep[];
}

export function summarizeToolTrace(
  parts: DynamicToolUIPart[],
): ToolTraceSummary {
  const sequence: ToolTraceStep[] = [];
  const members: DynamicToolUIPart[][] = [];
  let errorCount = 0;

  for (const part of parts) {
    if (part.state === "output-error") errorCount += 1;
    const name = formatToolName(part);
    const last = sequence[sequence.length - 1];
    if (last && last.name === name) {
      last.count += 1;
      members[members.length - 1].push(part);
    } else {
      sequence.push({
        name,
        raw: rawToolName(part),
        count: 1,
        state: part.state,
      });
      members.push([part]);
    }
  }
  sequence.forEach((step, index) => {
    step.state = aggregateToolState(members[index]);
  });

  return { state: aggregateToolState(parts), errorCount, sequence };
}
