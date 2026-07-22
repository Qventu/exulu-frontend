"use client";

/**
 * Route-local wrapper around the shared `<BudgetBar>` that exposes its
 * projection / remaining / reset-date detail through a click+focus
 * `<Popover>` — making the data keyboard- and touch-reachable
 * (budgets.md ladder item 32; responsive.md §3.T7 "every datum reachable
 * without hover"). The shared BudgetBar still hosts the Radix Tooltip for
 * pointer users; we wrap it in a focusable button so keyboard / touch users
 * can summon the same detail via a Popover anchored on the bar.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { BudgetBar } from "@/components/budget-bar";
import { BudgetDetailLines } from "@/components/budget-details";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type BudgetInfo } from "@/lib/budget";
import { cn } from "@/lib/utils";

export interface BudgetBarWithDetailsProps {
  budget: BudgetInfo | null;
  /** Mirrors the underlying BudgetBar `compact` prop (no inline numbers). */
  compact?: boolean;
  /** Accessible label for the trigger button (e.g. entity name). */
  triggerLabel: string;
  className?: string;
}

export function BudgetBarWithDetails({
  budget,
  compact = false,
  triggerLabel,
  className,
}: BudgetBarWithDetailsProps) {
  const t = useTranslations("budgets");

  // No budget — render the shared "No budget" string with no popover.
  if (!budget || budget.max_budget == null || budget.max_budget <= 0) {
    return <BudgetBar budget={budget} compact={compact} className={className} />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("bar.detailsAria", { name: triggerLabel })}
          className={cn(
            "block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <BudgetBar budget={budget} compact={compact} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1 text-xs">
        <BudgetDetailLines budget={budget} />
      </PopoverContent>
    </Popover>
  );
}
