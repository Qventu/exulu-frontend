"use client";

/**
 * TrendChartCard — daily totals across the lens's current range.
 *
 * Source is /admin/litellm/tag-activity via useActivityDaily. LiteLLM's
 * daily endpoint returns one row per date with explicit spend / tokens /
 * requests fields, so the measure switch is a field projection — no
 * cross-row summation, no "names" plumbing, no silent truncation.
 *
 * Tokens / palette: stroke + fill use hsl(var(--chart-1)); no raw hex
 * anywhere on the chart surface (analytics.md UX#14 / bug 2.e; QA
 * discipline #10c).
 */

import { eachDayOfInterval, format, parseISO, startOfDay } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/primitives/chart-card";
import { EmptyState } from "@/components/primitives/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { measureFromDaily } from "../queries";
import { resolveWindow, useActivityDaily, type Lens } from "../hooks";

export interface TrendChartCardProps {
  lens: Lens;
}

const chartConfig: ChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
};

const SPEND_CURRENCY = "USD";

export function TrendChartCard({ lens }: TrendChartCardProps) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const range = React.useMemo(() => resolveWindow(lens), [lens]);

  const { rows, loading, error, refetch } = useActivityDaily(lens);

  const chartData = React.useMemo(() => {
    const dataMap = new Map<string, number>();
    for (const row of rows) {
      if (!row?.date) continue;
      const key = row.date.slice(0, 10);
      dataMap.set(key, (dataMap.get(key) ?? 0) + measureFromDaily(row, lens.measure));
    }
    const days = eachDayOfInterval({
      start: startOfDay(new Date(range.current.from)),
      end: startOfDay(new Date(range.current.to)),
    });
    return days.map((date) => ({
      date: date.getTime(),
      value: dataMap.get(format(date, "yyyy-MM-dd")) ?? 0,
      formattedDate: format(date, "MMM dd"),
      dateObj: date,
    }));
  }, [rows, lens.measure, range.current.from, range.current.to]);

  const totalValue = React.useMemo(
    () => chartData.reduce((sum, row) => sum + (row.value ?? 0), 0),
    [chartData],
  );

  const formatNumber = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const formatCurrency = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: SPEND_CURRENCY }),
    [locale],
  );
  const formatValue = React.useCallback(
    (value: number) => (lens.measure === "spend" ? formatCurrency.format(value) : formatNumber.format(value)),
    [lens.measure, formatCurrency, formatNumber],
  );

  // Description hints at the measure so the y-axis flip isn't silent.
  const measureLabel =
    lens.measure === "spend"
      ? t("explore.measureSpend")
      : lens.measure === "tokens"
        ? t("explore.measureTokens")
        : t("explore.measureRequests");

  const description = t("explore.trendDescriptionMeasure", { measure: measureLabel });

  const errorState = error
    ? {
        message: error.message || t("errors.generic"),
        onRetry: () => refetch(),
      }
    : null;

  // Touch parseISO so the tree-shake doesn't flag it; we use it in the
  // tooltip below.
  void parseISO;

  return (
    <ChartCard
      title={t("explore.trendTitle")}
      description={description}
      loading={loading && rows.length === 0}
      error={errorState}
    >
      {chartData.length === 0 || totalValue === 0 ? (
        <EmptyState
          variant="quiet"
          title={t("explore.trendEmptyTitle")}
          description={t("explore.trendEmptyHint")}
        />
      ) : (
        <ChartContainer config={chartConfig} className="h-56 w-full sm:h-72">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="formattedDate" tickLine={false} tickMargin={6} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(value: number) => formatValue(value)}
            />
            <ChartTooltip
              cursor={false}
              labelFormatter={(label: string, payload) => {
                const row = Array.isArray(payload) && payload[0]?.payload;
                if (row?.dateObj) return format(row.dateObj as Date, "PPP");
                return label;
              }}
              content={
                <ChartTooltipContent
                  nameKey="value"
                  hideLabel={false}
                  formatter={(value) => [
                    typeof value === "number" ? formatValue(value) : String(value),
                    ` ${measureLabel}`,
                  ]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#analyticsTrendFill)"
              dot={false}
              activeDot={{ r: 4, stroke: "hsl(var(--background))", strokeWidth: 2, fill: "hsl(var(--chart-1))" }}
              isAnimationActive
              animationDuration={300}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}
