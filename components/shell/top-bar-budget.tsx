"use client";

/**
 * TopBarBudget — compact spend indicator for the desktop TopBar, sitting next
 * to the ⌘K search affordance.
 *
 * Visible whenever the signed-in user has a budget: the backend (`/me/budget`
 * → getUserBudgetView) already gates the snapshot on the admin "Show budget
 * status in chat" setting and returns null otherwise, so presence of a budget
 * here == should-show. This replaces the old in-chat chip that only appeared
 * at ≥80% usage (so an enabled budget below that threshold looked broken —
 * "nothing shows"); the indicator now lives in the chrome and is always
 * visible, with a click/focus Popover carrying the spend / remaining /
 * projection detail (keyboard- and touch-reachable, unlike a hover tooltip).
 */

import { useTranslations } from "next-intl";

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

const DOT_COLOR: Record<string, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  over: "bg-red-500",
};

export function TopBarBudget({ budget }: { budget: BudgetInfo | null }) {
  const t = useTranslations("budgets");

  // No budget (or none enabled for this user) — render nothing.
  if (!budget || budget.max_budget == null || budget.max_budget <= 0) {
    return null;
  }

  const projection = computeBudgetProjection(budget);
  const remaining = Math.max((budget.max_budget ?? 0) - budget.spend, 0);

  // "percent" mode hides the exact USD figures from the indicator and shows a
  // percentage instead (admin setting user_budget_display). Note: per product
  // decision this is UI-only — the raw figures are still present in the
  // /me/budget payload.
  const percentMode = budget.display === "percent";
  const usedPct = Math.round(projection.percentUsed);
  const leftPct = Math.max(0, 100 - usedPct);
  const projectedPct =
    projection.projectedPercent != null
      ? Math.round(projection.projectedPercent)
      : null;

  // Chip face + accessible name — never leak USD in percent mode.
  const chipLabel = percentMode
    ? t("bar.percentLeft", { percent: leftPct })
    : `${formatUsd(budget.spend)} / ${formatUsd(budget.max_budget)}`;
  const chipAria = percentMode
    ? t("bar.percentUsed", { percent: usedPct })
    : t("bar.usedOfMax", {
        spend: formatUsd(budget.spend),
        max: formatUsd(budget.max_budget),
      });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={chipAria}
          className={cn(
            "hidden h-8 shrink-0 items-center gap-2 rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground md:flex",
            "transition-colors duration-150 ease-in-out hover:bg-sidebar-accent/50 hover:text-sidebar-foreground motion-reduce:transition-none",
            "ring-offset-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 shrink-0 rounded-full",
              DOT_COLOR[projection.level],
            )}
          />
          <span className="font-mono tabular-nums">{chipLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-1 text-xs">
        <p className="font-medium">
          {percentMode
            ? t("bar.percentUsed", { percent: usedPct })
            : t("bar.usedOfMax", {
                spend: formatUsd(budget.spend),
                max: formatUsd(budget.max_budget),
              })}
        </p>
        <p>
          {percentMode
            ? t("bar.percentRemainingDuration", {
                percent: leftPct,
                duration: durationLabel(budget.budget_duration),
              })
            : t("bar.remainingDuration", {
                remaining: formatUsd(remaining),
                duration: durationLabel(budget.budget_duration),
              })}
        </p>
        {percentMode
          ? projectedPct != null && (
              <p
                className={
                  projection.overPace
                    ? "text-amber-600 dark:text-amber-400"
                    : undefined
                }
              >
                {projection.overPace
                  ? t("bar.projectedPercentOverPace", { percent: projectedPct })
                  : t("bar.projectedPercent", { percent: projectedPct })}
              </p>
            )
          : projection.projected != null && (
              <p
                className={
                  projection.overPace
                    ? "text-amber-600 dark:text-amber-400"
                    : undefined
                }
              >
                {projection.overPace
                  ? t("bar.projectedOverPace", {
                      amount: formatUsd(projection.projected),
                    })
                  : t("bar.projected", {
                      amount: formatUsd(projection.projected),
                    })}
              </p>
            )}
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
