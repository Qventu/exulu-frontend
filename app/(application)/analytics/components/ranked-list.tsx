"use client";

/**
 * RankedList — top-N entity list with proportional bars, used by the
 * Breakdown card's "List" view (analytics.md §3 layout). Pure presentation:
 * fetching, hydration and skeleton ownership live in breakdown-chart-card.
 *
 * Differences from the legacy `Leaderboard`:
 *   - keys = entry.id (stable) — fixes the display-name collision risk
 *     (analytics.md UX#17 / bug 2.f sibling).
 *   - bar background = `bg-primary/10` token-only — kills the raw
 *     `from-blue-100/50 dark:from-blue-900/20` hex (UX#14 / bug 2.e).
 *   - value text = `text-foreground` token — kills `text-slate-*` (UX#14).
 *   - top-3 styled by rank numeral + medal tint, NOT by caption strings
 *     ("Top performer" / "Runner up" / "Third place"); replaces the i18n
 *     leak (UX#10/#25).
 *   - zero console.log on render (UX#13 / bug 2.f sibling).
 */

import { useLocale } from "next-intl";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface RankedListEntry {
  id: string;
  name: string;
  value: number;
}

export interface RankedListProps {
  entries: RankedListEntry[];
  /** Unit label rendered below each value ("$" / "tokens" / "requests"). */
  unitLabel: string;
  /**
   * Active measure — switches the number formatter to currency for spend
   * (LiteLLM reports in USD; see analytics.md §4 Risks).
   */
  measure?: "spend" | "tokens" | "requests";
  /** Max rows to render (default 10). */
  max?: number;
  loading?: boolean;
  /** Skeleton row count when loading (default 5). */
  loadingRows?: number;
}

const SPEND_CURRENCY = "USD";

const RANK_STYLES: Record<number, string> = {
  // Subtle medal tints — token-only, additive ring tint on the rank numeral
  // bubble. Color is never the only carrier (the numeral itself is meaning).
  1: "bg-warning/20 text-warning",
  2: "bg-muted-foreground/20 text-muted-foreground",
  3: "bg-warning/10 text-warning",
};

export function RankedList({
  entries,
  unitLabel,
  measure = "requests",
  max = 10,
  loading = false,
  loadingRows = 5,
}: RankedListProps) {
  const locale = useLocale();
  const formatNumber = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const formatCurrency = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: SPEND_CURRENCY }),
    [locale],
  );
  const formatValue = React.useCallback(
    (value: number) => (measure === "spend" ? formatCurrency.format(value) : formatNumber.format(value)),
    [measure, formatCurrency, formatNumber],
  );

  if (loading) {
    return (
      <div className="space-y-2" role="status">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const visible = entries.slice(0, max);
  const maxValue = visible[0]?.value || 1;

  return (
    <ol className="space-y-2">
      {visible.map((entry, index) => {
        const rank = index + 1;
        const percentage = (entry.value / maxValue) * 100;
        const rankStyle = RANK_STYLES[rank] ?? "bg-muted text-muted-foreground";
        return (
          <li
            key={entry.id}
            className="relative overflow-hidden rounded-md border bg-card p-3 transition-colors duration-150 hover:bg-accent/40"
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-primary/10 motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-in-out"
              style={{ width: `${percentage}%` }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    rankStyle,
                  )}
                >
                  {rank}
                </span>
                <span
                  className="truncate text-sm font-medium text-foreground"
                  title={entry.name}
                >
                  {entry.name}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatValue(entry.value)}
                </p>
                <p className="text-xs text-muted-foreground">{unitLabel}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

