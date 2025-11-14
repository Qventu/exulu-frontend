"use client";

import * as React from "react";
import { useQuery } from "@apollo/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GET_TIME_SERIES_STATISTICS } from "@/queries/queries";
import { STATISTICS_TYPE } from "@/types/enums/statistics";
import { XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

interface TimeSeriesChartProps {
  dateRange: DateRange | undefined;
  selectedType: STATISTICS_TYPE;
  onTypeChange: (type: STATISTICS_TYPE) => void;
  onUnitChange: (unit: 'tokens' | 'count') => void;
  dataTypes: string[];
  unit: 'tokens' | 'count';
  unitOptions: { label: string, value: string }[];
}

function transformEnumToLabel(enumValue: string): string {
  return enumValue
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const chartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

export function TimeSeriesChart({ dataTypes, dateRange, selectedType, onTypeChange, onUnitChange, unit, unitOptions }: TimeSeriesChartProps) {
  const { data, loading, error } = useQuery(GET_TIME_SERIES_STATISTICS, {
    variables: {
      type: selectedType,
      name: unit,
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString(),
      names: [unit]
    },
    skip: !dateRange?.from || !dateRange?.to
  });

  const chartData = React.useMemo(() => {
    if (!data?.trackingStatistics || !dateRange?.from || !dateRange?.to) return [];

    // Transform API data into a map for quick lookup
    const dataMap = new Map();
    data.trackingStatistics.forEach((item: any) => {
      const dateObj = new Date(typeof item.group === 'number' ? item.group : Number(item.group));
      const dateKey = format(startOfDay(dateObj), 'yyyy-MM-dd');
      dataMap.set(dateKey, item.count);
    });

    // Generate all dates in the range
    const allDates = eachDayOfInterval({
      start: startOfDay(dateRange.from),
      end: startOfDay(dateRange.to)
    });

    // Fill gaps with zero values
    return allDates.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const count = dataMap.get(dateKey) || 0;

      return {
        date: date.getTime(),
        count: count,
        formattedDate: format(date, 'MMM dd'),
        dateObj: date
      };
    });
  }, [data, dateRange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Time Series Analytics</h3>
        <div className="flex items-center gap-2">
          <div className="w-[150px]">
            <Select value={selectedType} onValueChange={(value) => onTypeChange(value as STATISTICS_TYPE)}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {dataTypes?.map((type) => (
                  <SelectItem key={type} value={type}>
                    {transformEnumToLabel(type) + " "}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {
            unitOptions?.length > 1 && (<div className="w-[150px]">
              <Select value={unit} onValueChange={(value) => onUnitChange(value as 'tokens' | 'count')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>)
          }
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-4 h-full">
            <Skeleton className="h-full w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            Error loading time series data: {error.message}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No data available for the selected date range and type
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--muted-foreground))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--muted-foreground))"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="strokeCount" x1="0" y1="0" x2="1" y2="0">
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--muted-foreground))"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--muted-foreground))"
                    stopOpacity={0.6}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
                axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
                axisLine={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.5 }}
              />
              <ChartTooltip
                labelFormatter={(label: any, payload: any) => {
                  if (payload && payload[0]) {
                    return format(payload[0].payload.dateObj, 'PPP') + " ";
                  }
                  return label;
                }}
                content={<ChartTooltipContent
                  nameKey="name"
                  hideLabel
                  formatter={(value: any, name: any) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    " " + String(name)
                  ]}
                />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="url(#strokeCount)"
                strokeWidth={3}
                fill="url(#fillCount)"
                fillOpacity={0.6}
                dot={{
                  fill: "hsl(var(--muted-foreground))",
                  strokeWidth: 2,
                  r: 4,
                  strokeOpacity: 0.8
                }}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  fill: "hsl(var(--background))",
                  stroke: "hsl(var(--muted-foreground))",
                  strokeOpacity: 1
                }}
                name={transformEnumToLabel(selectedType)}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}