"use client";

/**
 * Route-local wrapper around the shared `<BudgetBar>` that exposes its
 * projection / remaining / reset-date detail through a click+focus
 * `<Popover>` — making the data keyboard- and touch-reachable
 * (budgets.md ladder item 32; responsive.md §3.T7 "every datum reachable
 * without hover"). The shared BudgetBar still hosts the Radix Tooltip for
 * pointer users; we wrap it in a focusable button so keyboard / touch users
 * can summon the same detail via a Popover anchored on the bar.
 *
 * The shared component (`components/budget-bar.tsx`) is consumed by the chat
 * BudgetBar widget and is under the cross-feature byte-stable rule, so the
 * fix lives here rather than inside the primitive. Follow-up: when the
 * byte-stable lock relaxes, the Tooltip-only path inside BudgetBar should be
 * upgraded to a single focus/click Popover (collapsing this wrapper).
 *
 * The reduced-motion guard on the bar fill animation (budgets.md item 29 —
 * "motion-reduce:transition-none") is ALSO blocked by the byte-stable rule
 * and tracked as a separate follow-up.
 */

import { useTranslations } from "next-intl";
import * as React from "react";

import { BudgetBar } from "@/components/budget-bar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeBudgetProjection,
  durationLabel,
  formatUsd,
  type BudgetInfo,
} from "@/lib/budget";
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

  const projection = computeBudgetProjection(budget);
  const remaining = Math.max((budget.max_budget ?? 0) - budget.spend, 0);

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
        <p className="font-medium">
          {t("bar.usedOfMax", {
            spend: formatUsd(budget.spend),
            max: formatUsd(budget.max_budget),
          })}
        </p>
        <p>
          {t("bar.remainingDuration", {
            remaining: formatUsd(remaining),
            duration: durationLabel(budget.budget_duration),
          })}
        </p>
        {projection.projected != null ? (
          <p className={projection.overPace ? "text-amber-600 dark:text-amber-400" : undefined}>
            {projection.overPace
              ? t("bar.projectedOverPace", {
                  amount: formatUsd(projection.projected),
                })
              : t("bar.projected", {
                  amount: formatUsd(projection.projected),
                })}
          </p>
        ) : null}
        {budget.budget_reset_at ? (
          <p className="text-muted-foreground">
            {t("bar.resetsOn", {
              date: new Date(budget.budget_reset_at).toLocaleDateString(),
            })}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
