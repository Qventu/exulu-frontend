"use client";

import * as React from "react";
import { useQuery } from "@apollo/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_DONUT_STATISTICS } from "@/queries/queries";
import { STATISTICS_TYPE } from "@/types/enums/statistics";
import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { DateRange } from "react-day-picker";

interface DonutChartProps {
  groupByOptions: { label: string, value: string }[];
  dateRange: DateRange | undefined;
  selectedType: STATISTICS_TYPE;
  groupBy: string;
  onGroupByChange: (groupBy: string) => void;
}

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
  "hsl(var(--chart-10))"
];

function transformGroupValue(value: string): string {
  if (!value) return 'Unknown';

  // Handle various formats and make them user-friendly
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function DonutChart({ groupByOptions, dateRange, selectedType, groupBy, onGroupByChange }: DonutChartProps) {
  const { data, loading, error } = useQuery(GET_DONUT_STATISTICS, {
    variables: {
      type: selectedType,
      groupBy,
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString()
    },
    skip: !dateRange?.from || !dateRange?.to
  });

  const { chartData, chartConfig } = React.useMemo(() => {
    if (!data?.trackingStatistics) return { chartData: [], chartConfig: {} };

    const sortedData = data.trackingStatistics
      .map((item: any, index: number) => ({
        name: transformGroupValue(item.group),
        value: item.count,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a: any, b: any) => b.value - a.value); // Sort by count descending

    const config: ChartConfig = sortedData.reduce((acc: any, item: any, index: number) => {
      acc[item.name] = {
        label: item.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
      return acc;
    }, {});

    return { chartData: sortedData, chartConfig: config };
  }, [data]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    if (percent < 0.05) return null; // Don't show labels for slices less than 5%

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="hsl(var(--background))"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
        stroke="hsl(var(--foreground))"
        strokeWidth="0.5"
        paintOrder="stroke"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Distribution</h3>
        {groupByOptions.length > 0 && (
          <div className="w-full max-w-[150px]">
            <Select value={groupBy} onValueChange={onGroupByChange}>
              <SelectTrigger>
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                {groupByOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-4 h-full">
            <Skeleton className="h-full w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            Error loading distribution data: {error.message}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-center">
            No data available for the selected date range, type, and grouping.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <PieChart>
              <defs>
                {chartData.map((entry: any, index: number) => (
                  <radialGradient
                    key={`gradient-${index}`}
                    id={`gradient-${entry.name.replace(/\s+/g, '-')}`}
                    cx="50%"
                    cy="50%"
                    r="50%"
                  >
                    <stop
                      offset="0%"
                      stopColor={entry.fill}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={entry.fill}
                      stopOpacity={0.8}
                    />
                  </radialGradient>
                ))}
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius="75%"
                innerRadius="45%"
                dataKey="value"
                stroke="hsl(var(--background))"
                strokeWidth={3}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#gradient-${entry.name.replace(/\s+/g, '-')})`}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="name"
                    hideLabel
                    formatter={(value: any, name: any) => [
                      typeof value === 'number' ? value.toLocaleString() : value,
                      String(name)
                    ]}
                  />
                }
              />
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}