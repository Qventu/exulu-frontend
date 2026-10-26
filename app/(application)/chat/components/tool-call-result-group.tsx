"use client";

/**
 * One collapsed card for a run of identical tool calls, in place of N stacked
 * "Completed" blocks. This is the second half of the fan-out problem: even
 * after approval, session 131113e2's 20 `jira_get_issue` calls left 20
 * identical collapsed cards to scroll past before the answer.
 *
 * Closed, it reads "Jira get issue · 20  [Completed]". Open, it lists one row
 * per call — each its own collapsible carrying that call's input and output,
 * so nothing is hidden, just nested one level deeper. Outputs are normalized
 * lazily, per row, when the row is opened: eagerly parsing 20 Jira payloads on
 * every stream tick is exactly the cost this card exists to avoid.
 */

import type { DynamicToolUIPart } from "ai";
import { useTranslations } from "next-intl";

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Response } from "@/components/ai-elements/response";
import { computeUntypedToolData } from "@/components/message-renderer-tool-data";
import { Skeleton } from "@/components/ui/skeleton";

import { getInputSummary, summarizeToolGroup } from "./tool-call-group-data";

/**
 * One call inside a collapsed card. Parses its own output, only once opened.
 * Shared with the tool-trace card (tool-trace.tsx), which names each row by
 * its tool via `title` — in a same-type group the tool is in the header, so
 * the row shows the input preview instead.
 */
export const ToolCallRow = ({
  part,
  index,
  total,
  title: titleOverride,
}: {
  part: DynamicToolUIPart;
  index: number;
  total: number;
  /** Row label; defaults to the input preview, then "Call i of N". */
  title?: string;
}) => {
  const t = useTranslations("chat");
  const summary = getInputSummary(part.input);
  const title =
    titleOverride ?? summary ?? t("toolGroup.callIndex", { index: index + 1, count: total });

  return (
    <Tool className="mb-0 rounded-none border-0 border-t border-border">
      <ToolHeader
        title={title}
        className="py-2 pl-6 text-left"
        type={part.type as `tool-${string}`}
        state={part.state}
      />
      <ToolContent>
        <ToolCallRowBody part={part} />
      </ToolContent>
    </Tool>
  );
};

/**
 * Split out so the normalization runs inside CollapsibleContent — Radix keeps
 * closed content unmounted, which is what makes the parse lazy.
 */
const ToolCallRowBody = ({ part }: { part: DynamicToolUIPart }) => {
  const data = computeUntypedToolData(part);
  const output = (data.part as { output?: unknown }).output;

  return (
    <>
      <ToolInput input={data.part.input} />
      <ToolOutput
        output={
          output ? (
            <Response chunked>
              {typeof output === "string"
                ? output
                : JSON.stringify(output, null, 2)}
            </Response>
          ) : (
            !part.errorText && <Skeleton className="h-4 w-full" />
          )
        }
        errorText={part.errorText}
      />
    </>
  );
};

export interface ToolCallResultGroupProps {
  /** The run's parts, in call order. */
  parts: DynamicToolUIPart[];
  /** Raw part type, e.g. "tool-jira_get_issue". */
  toolType: string;
}

export const ToolCallResultGroup = ({
  parts,
  toolType,
}: ToolCallResultGroupProps) => {
  const t = useTranslations("chat");
  const summary = summarizeToolGroup(parts);

  // Same name derivation as the single-call block, so a group and a lone call
  // carry an identical label.
  let styleToolName = toolType.replace(/ /g, "-").replace(/tool-/g, "").replace(/_/g, " ");
  styleToolName = styleToolName.charAt(0).toUpperCase() + styleToolName.slice(1);

  return (
    <Tool className="mt-3" defaultOpen={false} data-demo-id="chat-tool-trace">
      <ToolHeader
        title={styleToolName}
        className="capitalize"
        type={toolType as `tool-${string}`}
        state={summary.state}
        count={parts.length}
      />
      <ToolContent>
        <div className="px-4 pt-3 text-xs text-muted-foreground">
          {t("toolGroup.callCount", { count: parts.length })}
          {summary.errorCount > 0 &&
            ` — ${t("toolGroup.errors", { count: summary.errorCount })}`}
        </div>
        <div className="mt-2">
          {parts.map((part, index) => (
            <ToolCallRow
              key={part.toolCallId ?? `${toolType}-${index}`}
              part={part}
              index={index}
              total={parts.length}
            />
          ))}
        </div>
      </ToolContent>
    </Tool>
  );
};
