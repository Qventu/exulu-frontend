"use client";

/**
 * UsagePopover — the chat header's token-transparency surface.
 *
 * Spec: design/pages/chat.md items 27 (context-window usage, L1 chip → L2
 * detail) and 38 (token breakdown at L2) — fixes U7: the ai-elements
 * `Context`/`ContextContent*` breakdown was imported by the chat monolith but
 * never rendered. Also hosts the BudgetBar widget when the user has a budget
 * (item 73 detail; "costs ≤L2", philosophy §8).
 *
 * The popover is click-to-open (no hover-only affordance, responsive.md T7).
 * `UsageDialog` (additive export, flagged in the builder report) renders the
 * same breakdown in a small centered dialog — it is the ⋯ menu's "Usage"
 * entry, the chip's mobile home per chat.md's <sm header compression, since a
 * popover cannot anchor to a chip that is hidden below `sm`.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import {
  Context,
  ContextCacheUsage,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
} from "@/components/ai-elements/context";
import { BudgetBar } from "@/components/budget-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BudgetInfo } from "@/lib/budget";

import type { TokenCounts } from "../hooks";

export interface UsagePopoverProps {
  tokenCounts: TokenCounts;
  maxContextLength?: number | null;
  /** `user.budget` (UserBudgetView / BudgetInfo shape), rendered via BudgetBar. */
  budget?: unknown | null;
  /** Trigger element. */
  children: React.ReactNode;
}

/**
 * Shared breakdown body: the ai-elements Context provider + content pieces.
 * `Context` is only a provider here (its HoverCard root renders children
 * untouched) — interaction is owned by the Popover/Dialog hosts, which gives
 * the click-to-open behavior the HoverCard-based `ContextTrigger` cannot.
 */
function UsageBreakdown({
  tokenCounts,
  maxContextLength,
  budget,
}: {
  tokenCounts: TokenCounts;
  maxContextLength?: number | null;
  budget?: unknown | null;
}) {
  const t = useTranslations("chat");
  const compactTotal = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(tokenCounts.totalTokens);
  const hasMax = typeof maxContextLength === "number" && maxContextLength > 0;
  const budgetInfo = (budget as BudgetInfo | null | undefined) ?? null;

  return (
    <Context
      usedTokens={tokenCounts.totalTokens}
      maxTokens={hasMax ? (maxContextLength as number) : 0}
      usage={{
        inputTokens: tokenCounts.inputTokens,
        outputTokens: tokenCounts.outputTokens,
        totalTokens: tokenCounts.totalTokens,
        cachedInputTokens: tokenCounts.cachedInputTokens,
        reasoningTokens: tokenCounts.reasoningTokens,
      }}
    >
      <div className="divide-y">
        {hasMax ? <ContextContentHeader /> : null}
        <ContextContentBody className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("usage.total")}</span>
            <span>{compactTotal}</span>
          </div>
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextReasoningUsage />
          <ContextCacheUsage />
          {/* Plain-language explainer — philosophy §10: explain "tokens" in place. */}
          <p className="pt-1 text-xs text-muted-foreground">
            {t("usage.tokensExplainer")}
          </p>
        </ContextContentBody>
        {budgetInfo ? (
          <div className="space-y-2 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("usage.budgetTitle")}
            </p>
            <BudgetBar budget={budgetInfo} />
          </div>
        ) : null}
      </div>
    </Context>
  );
}

export function UsagePopover({
  tokenCounts,
  maxContextLength,
  budget,
  children,
}: UsagePopoverProps) {
  const t = useTranslations("chat");

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        aria-label={t("usage.title")}
      >
        <UsageBreakdown
          tokenCounts={tokenCounts}
          maxContextLength={maxContextLength}
          budget={budget}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface UsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenCounts: TokenCounts;
  maxContextLength?: number | null;
  budget?: unknown | null;
}

/**
 * Dialog form of the same breakdown — opened from the header ⋯ menu's
 * "Usage" item (always present; the only usage path while the chip is
 * hidden below `sm`).
 */
export function UsageDialog({
  open,
  onOpenChange,
  tokenCounts,
  maxContextLength,
  budget,
}: UsageDialogProps) {
  const t = useTranslations("chat");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle className="text-base">{t("usage.title")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("usage.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="border-t">
          <UsageBreakdown
            tokenCounts={tokenCounts}
            maxContextLength={maxContextLength}
            budget={budget}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
