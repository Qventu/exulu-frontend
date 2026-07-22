"use client";

import { useTranslations } from "next-intl";

import { buildBudgetDetailLines, type BudgetInfo } from "@/lib/budget";
import { cn } from "@/lib/utils";

/**
 * Shared used / remaining / projection / reset-date lines for budget popovers
 * and tooltips (TopBarBudget, BudgetBar tooltip, BudgetBarWithDetails, the
 * project-detail indicator). Percent-aware: when `budget.display ===
 * "percent"` no USD figure ever reaches the DOM — line selection lives in
 * lib/budget.ts (buildBudgetDetailLines) where it is unit-tested. Renders
 * bare <p> siblings; the host owns spacing (space-y-1) and text size.
 */
export function BudgetDetailLines({ budget }: { budget: BudgetInfo }) {
  const t = useTranslations("budgets");
  return (
    <>
      {buildBudgetDetailLines(budget).map((line) => (
        <p
          key={line.key}
          className={cn(
            line.emphasis && "font-medium",
            line.tone === "warn" && "text-amber-600 dark:text-amber-400",
            line.tone === "muted" && "text-muted-foreground",
          )}
        >
          {t(line.key, line.values)}
        </p>
      ))}
    </>
  );
}
