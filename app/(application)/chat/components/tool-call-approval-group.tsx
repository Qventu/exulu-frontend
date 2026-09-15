"use client";

/**
 * One approval card for a run of identical tool calls.
 *
 * WHY: the model fans a tool out in parallel — session 131113e2 issued 20
 * `jira_get_issue` calls in a single step. The AI SDK mints an approval id per
 * call and will not resume the stream until every one has an answer, so the
 * single-call card (tool-call-approval.tsx) forced 20 clicks through 20 cards.
 * "Allow for this chat" cannot help: the server evaluates needsApproval for
 * all N calls before the first round-trip reaches the browser.
 *
 * So the buttons here answer EVERY pending id in the run at once. Deliberately
 * no per-call deny: the granular escape is Deny all, then re-prompt. Mixed
 * per-call verdicts would need N cards again, which is the thing being fixed.
 */

import type {
  ChatAddToolApproveResponseFunction,
  DynamicToolUIPart,
} from "ai";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { summarizeToolGroup } from "./tool-call-group-data";

/** Input previews listed up front before the rest collapse into a count. */
const VISIBLE_SUMMARIES = 6;

export interface ToolCallApprovalGroupProps {
  /** The run's parts, in call order. */
  parts: DynamicToolUIPart[];
  /** Raw part type, e.g. "tool-jira_get_issue" — the pre-approval key. */
  toolType: string;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  /** Persist pre-approval via the controller (stable localStorage key). */
  onApproveForChat: (toolId: string) => void;
}

export const ToolCallApprovalGroup = ({
  parts,
  toolType,
  addToolApprovalResponse,
  onApproveForChat,
}: ToolCallApprovalGroupProps) => {
  const t = useTranslations("chat");

  const toolName = toolType.replace("tool-", "").replace(/_/g, " ");
  const summary = summarizeToolGroup(parts);
  const count = parts.length;

  const respondToAll = (approved: boolean) => {
    for (const id of summary.pendingApprovalIds) {
      addToolApprovalResponse({ id, approved });
    }
  };

  // Every call answered: one resolved line for the whole run, in place of the
  // N confirmation rows the single-call card would have stacked up.
  if (summary.pendingApprovalIds.length === 0) {
    const allDenied = summary.deniedCount === count;
    const allApproved = summary.deniedCount === 0;
    const label = allDenied
      ? t("approval.groupDenied", { tool: toolName, count })
      : allApproved
        ? t("approval.groupApproved", { tool: toolName, count })
        : t("approval.groupMixed", { tool: toolName, count });

    return (
      <div
        role="status"
        className={cn(
          "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2",
          allDenied
            ? "border-destructive/30 bg-destructive/5"
            : "border-success/30 bg-success/5",
        )}
      >
        {allDenied ? (
          <XCircle
            className="size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <CheckCircle2
            className="size-4 shrink-0 text-success"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            allDenied ? "text-destructive" : "text-success",
          )}
        >
          {label}
        </span>
      </div>
    );
  }

  // Calls stream in, so a run can briefly hold one pending approval while the
  // rest are still arriving. Count the ASK, not the run, and drop to the
  // singular copy at one — "Allow all 1" reads like a bug.
  const pendingCount = summary.pendingApprovalIds.length;
  const isSingle = pendingCount === 1;

  const visible = summary.inputSummaries
    .filter((value): value is string => !!value)
    .slice(0, VISIBLE_SUMMARIES);
  const hiddenCount = count - visible.length;

  return (
    <Card className="mt-3 border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-medium">
              {isSingle
                ? t("approval.title", { tool: toolName })
                : t("approval.groupTitle", { tool: toolName, count: pendingCount })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isSingle
                ? t("approval.description")
                : t("approval.groupDescription", { count: pendingCount })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length > 0 && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <ul className="space-y-1">
              {visible.map((value, index) => (
                <li
                  key={`${value}-${index}`}
                  className="truncate break-all font-mono text-xs text-muted-foreground"
                >
                  {value}
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("approval.groupMore", { count: hiddenCount })}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-11 sm:h-9 sm:flex-1"
            onClick={() => respondToAll(true)}
          >
            {isSingle
              ? t("approval.allowOnce")
              : t("approval.groupAllowAll", { count: pendingCount })}
          </Button>
          <Button
            variant="outline"
            className="h-11 sm:h-9 sm:flex-1"
            onClick={() => {
              respondToAll(true);
              onApproveForChat(toolType);
            }}
          >
            {t("approval.allowForChat")}
          </Button>
          <Button
            variant="outline"
            className="h-11 text-destructive hover:text-destructive sm:h-9 sm:flex-1"
            onClick={() => respondToAll(false)}
          >
            {isSingle ? t("approval.deny") : t("approval.groupDenyAll")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
