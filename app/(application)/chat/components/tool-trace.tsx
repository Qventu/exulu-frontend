"use client";

/**
 * ToolTrace — ONE collapsed card for a run of consecutive tool calls of any
 * kind, in place of N stacked "Completed" blocks.
 *
 * The parallel fan-out (20 × jira_get_issue in one step) already folds into
 * tool-call-result-group.tsx. This is the other half: the sequential agent
 * loop — Bash, a Hubspot list, Bash again, four Hubspot reads, one call per
 * step — which left eight cards between the question and the answer
 * (message-renderer-tool-groups.ts traceRenderUnits decides what is a run).
 *
 * Closed, it reads "Tool calls · 8  [Completed]" over one sequence line —
 * "Bash → Hubspot list tools → Bash → … → Hubspot read ×4" — so the whole
 * route is legible at a glance (transparency without the scroll). A failed
 * step is marked in the line; the running one pulses while the stream is
 * live. Open, it lists one row per call named by its tool and input preview,
 * each its own collapsible with input and output — nothing is hidden, just
 * nested one level deeper (same rows as the grouped card).
 */

import type { DynamicToolUIPart } from "ai";
import { ChevronRight, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { isDemoMode } from "@/lib/demo/flag";
import { toolLabel } from "@/lib/demo/overlays";
import { cn } from "@/lib/utils";

import { getInputSummary } from "./tool-call-group-data";
import { ToolCallRow } from "./tool-call-result-group";
import {
  formatToolName,
  rawToolName,
  summarizeToolTrace,
} from "./tool-trace-data";

const RUNNING = new Set<string>(["input-streaming", "input-available"]);

/** Product: "Hubspot read"; demo: the German label for the raw tool name. */
const displayName = (name: string, raw: string): string =>
  isDemoMode() ? toolLabel(raw) : name;

export interface ToolTraceProps {
  /** The run's calls, in order (step-start parts already dropped). */
  parts: DynamicToolUIPart[];
}

export const ToolTrace = ({ parts }: ToolTraceProps) => {
  const t = useTranslations("chat");
  const summary = summarizeToolTrace(parts);

  return (
    <Tool className="mt-3" defaultOpen={false} data-demo-id="chat-tool-trace">
      <ToolHeader
        title={t("toolTrace.title")}
        type={"tool-trace" as `tool-${string}`}
        state={summary.state}
        count={parts.length}
        className="pb-1"
      />
      {/* The route, outside the trigger: a plain list the header never
          swallows into its accessible name. */}
      <ol
        aria-label={t("toolTrace.sequence")}
        className="flex flex-wrap items-center gap-y-1 px-3 pb-3 pl-9 text-xs text-muted-foreground"
      >
        {summary.sequence.map((step, index) => {
          const failed =
            step.state === "output-error" || step.state === "output-denied";
          const running = RUNNING.has(step.state);
          return (
            <li key={`${step.raw}-${index}`} className="flex items-center">
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="mx-1 size-3 shrink-0 opacity-60"
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1 whitespace-nowrap",
                  failed && "text-destructive",
                  running && "text-foreground motion-safe:animate-pulse",
                )}
              >
                {failed ? (
                  <XCircle aria-hidden="true" className="size-3" />
                ) : null}
                {displayName(step.name, step.raw)}
                {step.count > 1 ? ` ×${step.count}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
      <ToolContent>
        {summary.errorCount > 0 ? (
          <div className="px-4 pb-2 text-xs text-destructive">
            {t("toolGroup.errors", { count: summary.errorCount })}
          </div>
        ) : null}
        <div>
          {parts.map((part, index) => {
            const name = displayName(formatToolName(part), rawToolName(part));
            const preview = getInputSummary(part.input);
            return (
              <ToolCallRow
                key={part.toolCallId ?? `${part.type}-${index}`}
                part={part}
                index={index}
                total={parts.length}
                title={preview ? `${name} · ${preview}` : name}
              />
            );
          })}
        </div>
      </ToolContent>
    </Tool>
  );
};
