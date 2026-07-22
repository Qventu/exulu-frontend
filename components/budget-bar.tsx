"use client"

import { useTranslations } from "next-intl"

import { BudgetDetailLines } from "@/components/budget-details"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    computeBudgetProjection,
    formatUsd,
    type BudgetInfo,
} from "@/lib/budget"
import { cn } from "@/lib/utils"

const FILL_COLORS: Record<string, string> = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    over: "bg-red-500",
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Animated, colour-coded budget bar with a burn-rate projection marker.
 * - fill width animates via a CSS transition on width
 * - colour: green (on track) / amber (≥80% or on track to exceed) / red (over)
 * - the dashed marker shows the projected spend by the reset date
 * - display-aware: `budget.display === "percent"` renders percentages only
 *   (inline numbers and tooltip switch to the bar.percent* strings — no USD
 *   anywhere). Absent / "amount" keeps the dollar rendering; admin queries
 *   never set `display`, so admin surfaces are unchanged.
 * Used in the admin overview, the BudgetEditor, the in-chat indicator, and
 * the project-detail header indicator.
 */
export function BudgetBar({
    budget,
    compact = false,
    className,
}: {
    budget: BudgetInfo | null
    compact?: boolean
    className?: string
}) {
    const t = useTranslations("budgets")

    if (!budget || budget.max_budget == null || budget.max_budget <= 0) {
        return (
            <span className={cn("text-xs text-muted-foreground", className)}>
                No budget
            </span>
        )
    }

    const p = computeBudgetProjection(budget)
    const usedPct = clamp(p.percentUsed)
    const projPct = p.projectedPercent != null ? clamp(p.projectedPercent) : null
    const percentMode = budget.display === "percent"

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("w-full", className)}>
                        <div
                            className={cn(
                                "relative w-full overflow-hidden rounded-full bg-muted",
                                compact ? "h-2" : "h-3",
                            )}
                        >
                            <div
                                className={cn(
                                    "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                                    FILL_COLORS[p.level],
                                )}
                                style={{ width: `${usedPct}%` }}
                            />
                            {projPct != null && (
                                <div
                                    className="absolute top-0 h-full border-l-2 border-dashed border-foreground/60"
                                    style={{ left: `calc(${projPct}% - 1px)` }}
                                    aria-hidden
                                />
                            )}
                        </div>
                        {!compact && (
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                                {percentMode ? (
                                    <span>
                                        {t("bar.percentUsed", {
                                            percent: Math.round(p.percentUsed),
                                        })}
                                    </span>
                                ) : (
                                    <>
                                        <span>
                                            {formatUsd(budget.spend)} / {formatUsd(budget.max_budget)}
                                        </span>
                                        <span>{Math.round(p.percentUsed)}%</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="space-y-1 text-xs">
                    <BudgetDetailLines budget={budget} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
