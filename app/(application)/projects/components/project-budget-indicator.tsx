"use client";

/**
 * Read-only budget usage for the project detail header (spec
 * docs/superpowers/specs/2026-07-20-project-budget-visibility-design.md):
 * compact shared BudgetBar + rounded percentage face, wrapped in a focusable
 * click/keyboard Popover carrying the shared detail lines (same
 * accessibility pattern as the admin BudgetBarWithDetails — every datum
 * reachable without hover). The percentage face is mode-neutral, so the
 * chip itself never leaks USD regardless of the user_budget_display
 * setting; the popover/tooltip lines are percent-safe via BudgetDetailLines.
 * Renders nothing when the project has no capped budget. No edit
 * affordances by design.
 */

import { useTranslations } from "next-intl";

import { BudgetBar } from "@/components/budget-bar";
import { BudgetDetailLines } from "@/components/budget-details";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeBudgetProjection,
  hasCappedBudget,
  type BudgetInfo,
} from "@/lib/budget";

export function ProjectBudgetIndicator({
  budget,
  projectName,
}: {
  budget: BudgetInfo | null | undefined;
  projectName: string;
}) {
  const t = useTranslations("budgets");

  if (!hasCappedBudget(budget)) return null;

  const usedPct = Math.round(computeBudgetProjection(budget).percentUsed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("bar.detailsAria", { name: projectName })}
          // min-h-11 = 44px touch target below md (responsive.md DoD),
          // matching the instructions-active button beside it.
          className="flex min-h-11 w-44 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0"
        >
          <BudgetBar budget={budget} compact className="flex-1" />
          <span className="text-xs tabular-nums">{usedPct}%</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1 text-xs">
        <BudgetDetailLines budget={budget} />
      </PopoverContent>
    </Popover>
  );
}
