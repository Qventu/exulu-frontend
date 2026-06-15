"use client";

/**
 * DonutView — Share rendering of the Breakdown card (analytics.md §3
 * ladder #35, #39).
 *
 * Renders a recharts Pie + a color-keyed legend list below the ring, so
 * slice identity is no longer hover-only (UX#12). Labels use
 * hsl(var(--foreground)) — never raw black (UX#7 / bug 2.b; recent QA
 * discipline #10c). Palette pulls --chart-1..10 (globals.css declares all
 * ten in both themes; verified).
 */

import { useLocale } from "next-intl";
import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface DonutEntry {
  id: string;
  name: string;
  value: number;
}

export interface DonutViewProps {
  entries: DonutEntry[];
  /** Unit label for the tooltip / legend value column ("$" / "tokens" / "requests"). */
  unitLabel: string;
  /**
   * The active measure — switches the number formatter to currency for
   * spend (LiteLLM reports in USD; see analytics.md §4 Risks).
   */
  measure?: "spend" | "tokens" | "requests";
}

const SPEND_CURRENCY = "USD";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
  "hsl(var(--chart-9))",
  "hsl(var(--chart-10))",
];

export function DonutView({ entries, unitLabel, measure = "requests" }: DonutViewProps) {
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

  const sorted = React.useMemo(
    () =>
      [...entries]
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((entry, index) => ({
          ...entry,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        })),
    [entries],
  );

  const total = React.useMemo(
    () => sorted.reduce((sum, entry) => sum + entry.value, 0),
    [sorted],
  );

  const chartConfig: ChartConfig = React.useMemo(() => {
    return sorted.reduce<ChartConfig>((acc, entry, index) => {
      acc[entry.name] = {
        label: entry.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
      return acc;
    }, {});
  }, [sorted]);

  const renderLabel = ({ percent, cx, cy, midAngle, innerRadius, outerRadius }: {
    percent: number;
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
  }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer config={chartConfig} className="h-48 w-full sm:h-56">
        <PieChart>
          <Pie
            data={sorted}
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="75%"
            dataKey="value"
            nameKey="name"
            labelLine={false}
            label={renderLabel}
            strokeWidth={2}
            isAnimationActive
            animationDuration={300}
          >
            {sorted.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                hideLabel
                formatter={(value, name) => [
                  typeof value === "number" ? formatValue(value) : String(value),
                  ` ${String(name)}`,
                ]}
              />
            }
          />
        </PieChart>
      </ChartContainer>
      <ul className="space-y-1 text-xs">
        {sorted.map((entry) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: entry.fill }}
                />
                <span className="truncate text-foreground" title={entry.name}>
                  {entry.name}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {measure === "spend"
                  ? formatValue(entry.value)
                  : `${formatValue(entry.value)} ${unitLabel}`}{" "}
                · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
