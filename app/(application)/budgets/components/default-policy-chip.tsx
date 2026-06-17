"use client";

/**
 * PageHeader right-slot summary of the platform's default per-user budget
 * (budgets.md items 7–13 read view). Lifts the global policy out of the
 * legacy tab-scoped nested card so it is visible from every page state.
 *
 * Quiet single line — no purple. "Edit" only when `canWrite`. On settings
 * load failure renders "—" and an inline retry (fixes today's silent
 * `.catch(() => {})`). Opens `<DefaultPolicyDialog>` at L3 for editing.
 */

import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { BudgetSettings } from "@/lib/api/budgets";
import {
  durationLabel,
  formatUsd,
  type BudgetDuration,
} from "@/lib/budget";
import { cn } from "@/lib/utils";

export interface DefaultPolicyChipProps {
  settings: BudgetSettings | null;
  loading: boolean;
  loadError: Error | null;
  canWrite: boolean;
  onEdit: () => void;
  onRetryLoad: () => void;
  className?: string;
}

export function DefaultPolicyChip({
  settings,
  loading,
  loadError,
  canWrite,
  onEdit,
  onRetryLoad,
  className,
}: DefaultPolicyChipProps) {
  const t = useTranslations("budgets");

  let summary: React.ReactNode;
  if (loading) {
    summary = (
      <span className="text-muted-foreground">{t("policy.loading")}</span>
    );
  } else if (loadError) {
    summary = (
      <span className="inline-flex items-center gap-2">
        <span className="text-muted-foreground">—</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 py-0 text-xs"
          onClick={onRetryLoad}
        >
          {t("settings.retry")}
        </Button>
      </span>
    );
  } else if (settings?.global_user_budget.enabled) {
    const amount = formatUsd(settings.global_user_budget.max_budget);
    const period = t(
      `policy.duration.${(settings.global_user_budget.budget_duration as BudgetDuration) || "30d"}`,
    );
    summary = (
      <span>
        {t("policy.summaryDefault", { amount, period })}
        {settings.show_user_budget_in_chat
          ? ` · ${t("policy.summaryShownInChat")}`
          : ""}
      </span>
    );
  } else {
    summary = <span>{t("policy.summaryNone")}</span>;
  }

  return (
    <div
      className={cn(
        // Foreground (not muted) + User icon so admins don't gloss over the
        // per-user scope — this is the most important framing on the page
        // and the legacy chip read as a footnote.
        "flex flex-wrap items-center gap-2 text-sm text-foreground",
        className,
      )}
    >
      <User
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      {summary}
      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={t("policy.editAria")}
        >
          {t("policy.edit")}
        </Button>
      ) : null}
    </div>
  );
}
