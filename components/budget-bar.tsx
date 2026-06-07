"use client"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    computeBudgetProjection,
    durationLabel,
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
 * Used in the admin overview, the BudgetEditor, and the in-chat indicator.
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
    const remaining = Math.max((budget.max_budget ?? 0) - budget.spend, 0)

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
                                    "h-full rounded-full transition-[width] duration-700 ease-out",
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
                                <span>
                                    {formatUsd(budget.spend)} / {formatUsd(budget.max_budget)}
                                </span>
                                <span>{Math.round(p.percentUsed)}%</span>
                            </div>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="space-y-1 text-xs">
                    <div className="font-medium">
                        {formatUsd(budget.spend)} of {formatUsd(budget.max_budget)} used
                    </div>
                    <div>{formatUsd(remaining)} remaining · {durationLabel(budget.budget_duration)}</div>
                    {p.projected != null && (
                        <div className={p.overPace ? "text-amber-500" : undefined}>
                            Projected ≈ {formatUsd(p.projected)} by reset
                            {p.overPace ? " (over pace)" : ""}
                        </div>
                    )}
                    {budget.budget_reset_at && (
                        <div className="text-muted-foreground">
                            Resets {new Date(budget.budget_reset_at).toLocaleDateString()}
                        </div>
                    )}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
