"use client";

/**
 * TrendChartCard — daily totals across the lens's current range.
 *
 * Fixes the two compounding bugs of the legacy TimeSeriesChart
 * (analytics.md bug 2.c):
 *   1) names mismatch — measure=tokens now sends ["inputTokens","outputTokens"]
 *      (the donut already did this correctly; we mirror it).
 *   2) silent truncation — GET_TIME_SERIES_STATISTICS limit: 12 → 31 in
 *      queries/queries.ts (gated by ANALYTICS_TIME_SERIES_LIMIT_31_SUPPORTED).
 *
 * Tokens / palette: stroke + fill use hsl(var(--chart-1)); no raw hex
 * anywhere on the chart surface (analytics.md UX#14 / bug 2.e; recent QA
 * discipline #10c).
 */

import { useQuery } from "@apollo/client";
import { eachDayOfInterval, format, startOfDay } from "date-fns";
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

import { GET_TIME_SERIES_STATISTICS } from "../queries";
import { resolveWindow, type Lens } from "../hooks";

export interface TrendChartCardProps {
  lens: Lens;
}

const chartConfig: ChartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--chart-1))",
  },
};

export function TrendChartCard({ lens }: TrendChartCardProps) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const window = React.useMemo(() => resolveWindow(lens), [lens]);

  const names =
    lens.measure === "tokens" ? ["inputTokens", "outputTokens"] : ["count"];

  const { data, loading, error, refetch } = useQuery(GET_TIME_SERIES_STATISTICS, {
    variables: {
      type: lens.type,
      from: window.current.from,
      to: window.current.to,
      names,
    },
  });

  const chartData = React.useMemo(() => {
    if (!data?.trackingStatistics) return [];
    const dataMap = new Map<string, number>();
    for (const item of data.trackingStatistics) {
      const groupRaw = item?.group;
      if (groupRaw == null) continue;
      const ms = typeof groupRaw === "number" ? groupRaw : Number(groupRaw);
      if (!Number.isFinite(ms)) continue;
      const key = format(startOfDay(new Date(ms)), "yyyy-MM-dd");
      // Multiple rows can map to the same day when names has 2 elements
      // (inputTokens + outputTokens) — sum them.
      dataMap.set(key, (dataMap.get(key) ?? 0) + (item.count ?? 0));
    }
    const days = eachDayOfInterval({
      start: startOfDay(new Date(window.current.from)),
      end: startOfDay(new Date(window.current.to)),
    });
    return days.map((date) => ({
      date: date.getTime(),
      count: dataMap.get(format(date, "yyyy-MM-dd")) ?? 0,
      formattedDate: format(date, "MMM dd"),
      dateObj: date,
    }));
  }, [data, window.current.from, window.current.to]);

  const totalValue = React.useMemo(
    () => chartData.reduce((sum, row) => sum + (row.count ?? 0), 0),
    [chartData],
  );

  const description = t("explore.trendDescription");

  const errorState = error
    ? {
        message: error.message || t("errors.generic"),
        onRetry: () => {
          void refetch();
        },
      }
    : null;

  const formatNumber = new Intl.NumberFormat(locale);

  return (
    <ChartCard
      title={t("explore.trendTitle")}
      description={description}
      loading={loading && !data}
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
              tickFormatter={(value: number) => formatNumber.format(value)}
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
                  nameKey="count"
                  hideLabel={false}
                  formatter={(value) => [
                    typeof value === "number" ? formatNumber.format(value) : String(value),
                    " ",
                  ]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="count"
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
