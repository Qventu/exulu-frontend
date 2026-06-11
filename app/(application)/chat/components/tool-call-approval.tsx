"use client";

/**
 * Tool-call approval card — route-local rebuild (chat.md item 50, fixes U4).
 *
 * Replaces components/tool-call-approval.tsx for the chat surface:
 * - theme tokens only (border-border / bg-card; resolved states use the
 *   semantic success / destructive tokens — no green-50/red-50/amber hardcodes);
 * - tool name + input summary are visible up front (no dead chevron row);
 * - corrected button hierarchy: Allow once = primary, Allow for this chat =
 *   outline, Deny = outline + text-destructive; stacks below `sm` (T5/T7);
 * - "Allow for this chat" delegates persistence to the controller via
 *   `onApproveForChat(toolId)` (stable `pre-approved-tool-calls-{sessionId}`
 *   localStorage key) — no window.location.pathname parsing.
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

export interface ToolCallApprovalProps {
  part: DynamicToolUIPart;
  addToolApprovalResponse: ChatAddToolApproveResponseFunction;
  /** Persist pre-approval via the controller (stable localStorage key). */
  onApproveForChat: (toolId: string) => void;
}

/**
 * Short, human-readable preview of the tool input (same heuristics as the
 * renderer's tool chips): well-known string fields first, then the first
 * short string value.
 */
const getInputSummary = (input: unknown): string | null => {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const preferredKeys = [
    "path",
    "file_path",
    "filename",
    "command",
    "query",
    "url",
    "question",
    "prompt",
    "text",
  ];
  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  const firstString = Object.values(record).find(
    (value) => typeof value === "string" && value.length > 0 && value.length < 300,
  );
  return typeof firstString === "string" ? firstString : null;
};

export const ToolCallApproval = ({
  part,
  addToolApprovalResponse,
  onApproveForChat,
}: ToolCallApprovalProps) => {
  const t = useTranslations("chat");

  const toolName =
    (part as { type: string }).type?.replace("tool-", "")?.replace(/_/g, " ") ||
    "command";
  // The id persisted for pre-approval — byte-identical to today's behavior
  // (the raw part type, e.g. "tool-bash").
  const toolId = (part as { type: string }).type;

  if (part.state === "approval-responded") {
    const isDenied =
      (part as { approval?: { approved?: boolean } }).approval?.approved ===
      false;

    return (
      <div
        role="status"
        className={cn(
          "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2",
          isDenied
            ? "border-destructive/30 bg-destructive/5"
            : "border-success/30 bg-success/5",
        )}
      >
        {isDenied ? (
          <XCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
        )}
        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            isDenied ? "text-destructive" : "text-success",
          )}
        >
          {isDenied
            ? t("approval.denied", { tool: toolName })
            : t("approval.approved", { tool: toolName })}
        </span>
      </div>
    );
  }

  if (!part.approval?.id) {
    return null;
  }

  if (part.state === "approval-requested") {
    const approvalId = part.approval.id as string;
    const inputSummary = getInputSummary(part.input);

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
                {t("approval.title", { tool: toolName })}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("approval.description")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {inputSummary && (
            <p className="line-clamp-3 break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
              {inputSummary}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="h-11 sm:h-9 sm:flex-1"
              onClick={() =>
                addToolApprovalResponse({ id: approvalId, approved: true })
              }
            >
              {t("approval.allowOnce")}
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9 sm:flex-1"
              onClick={() => {
                addToolApprovalResponse({ id: approvalId, approved: true });
                onApproveForChat(toolId);
              }}
            >
              {t("approval.allowForChat")}
            </Button>
            <Button
              variant="outline"
              className="h-11 text-destructive hover:text-destructive sm:h-9 sm:flex-1"
              onClick={() =>
                addToolApprovalResponse({ id: approvalId, approved: false })
              }
            >
              {t("approval.deny")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
