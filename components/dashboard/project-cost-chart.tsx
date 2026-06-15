"use client";

import * as React from "react";
import { useQuery } from "@apollo/client";
import { format, eachDayOfInterval, startOfDay, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GET_PROJECT_TOKEN_STATISTICS,
  GET_PROJECT_AGENT_TOKEN_STATISTICS,
  GET_PROJECTS,
  GET_AGENTS,
} from "@/queries/queries";
import { DateRangeSelector } from "./date-range-selector";

const chartConfig = {
  inputTokens: {
    label: "Input Tokens",
    color: "hsl(var(--primary))",
  },
  outputTokens: {
    label: "Output Tokens",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig;

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

interface ProjectCostChartProps {
  initialDateRange?: DateRange;
}

export function ProjectCostChart({ initialDateRange }: ProjectCostChartProps) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    initialDateRange ?? { from: subDays(new Date(), 14), to: new Date() }
  );
  const [selectedProject, setSelectedProject] = React.useState<string>("");

  const { data: projectsData, loading: projectsLoading } = useQuery(GET_PROJECTS, {
    variables: { page: 1, limit: 100 },
  });

  const { data: agentsData } = useQuery(GET_AGENTS, {
    variables: { page: 1, limit: 200 },
  });

  const projects = projectsData?.projectsPagination?.items ?? [];
  const agents: any[] = agentsData?.agentsPagination?.items ?? [];

  // Map agent name → prices for quick lookup
  const agentPriceMap = React.useMemo(() => {
    const map = new Map<string, { priceInput: number; priceOutput: number }>();
    agents.forEach((a) => {
      map.set(a.name, {
        priceInput: a.price_input_token ?? 0,
        priceOutput: a.price_output_token ?? 0,
      });
    });
    return map;
  }, [agents]);

  const skip = !selectedProject || !dateRange?.from || !dateRange?.to;
  const vars = {
    project: selectedProject,
    from: dateRange?.from?.toISOString(),
    to: dateRange?.to?.toISOString(),
  };

  // Time-series: tokens per day (for the chart)
  const { data: inputData, loading: inputLoading } = useQuery(GET_PROJECT_TOKEN_STATISTICS, {
    variables: { ...vars, name: "inputTokens" },
    skip,
  });
  const { data: outputData, loading: outputLoading } = useQuery(GET_PROJECT_TOKEN_STATISTICS, {
    variables: { ...vars, name: "outputTokens" },
    skip,
  });

  // Per-agent totals (for cost calculation)
  const { data: agentInputData } = useQuery(GET_PROJECT_AGENT_TOKEN_STATISTICS, {
    variables: { ...vars, name: "inputTokens" },
    skip,
  });
  const { data: agentOutputData } = useQuery(GET_PROJECT_AGENT_TOKEN_STATISTICS, {
    variables: { ...vars, name: "outputTokens" },
    skip,
  });

  const loading = inputLoading || outputLoading;

  // Chart data: input + output tokens per day
  const chartData = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const toMap = (items: any[] = []) => {
      const m = new Map<string, number>();
      items.forEach((item) => {
        const d = new Date(typeof item.group === "number" ? item.group : Number(item.group));
        m.set(format(startOfDay(d), "yyyy-MM-dd"), item.count);
      });
      return m;
    };

    const inputMap = toMap(inputData?.trackingStatistics);
    const outputMap = toMap(outputData?.trackingStatistics);

    return eachDayOfInterval({
      start: startOfDay(dateRange.from),
      end: startOfDay(dateRange.to),
    }).map((date) => {
      const key = format(date, "yyyy-MM-dd");
      return {
        date: date.getTime(),
        formattedDate: format(date, "MMM dd"),
        dateObj: date,
        inputTokens: inputMap.get(key) ?? 0,
        outputTokens: outputMap.get(key) ?? 0,
      };
    });
  }, [inputData, outputData, dateRange]);

  // Per-agent cost breakdown using configured prices
  const agentBreakdown = React.useMemo(() => {
    const inputByAgent = new Map<string, number>();
    const outputByAgent = new Map<string, number>();

    (agentInputData?.trackingStatistics ?? []).forEach((s: any) => {
      inputByAgent.set(s.group, s.count);
    });
    (agentOutputData?.trackingStatistics ?? []).forEach((s: any) => {
      outputByAgent.set(s.group, s.count);
    });

    const agentNames = new Set([...inputByAgent.keys(), ...outputByAgent.keys()]);

    return Array.from(agentNames).map((name) => {
      const inputTokens = inputByAgent.get(name) ?? 0;
      const outputTokens = outputByAgent.get(name) ?? 0;
      const prices = agentPriceMap.get(name);
      const cost =
        (inputTokens / 1_000_000) * (prices?.priceInput ?? 0) +
        (outputTokens / 1_000_000) * (prices?.priceOutput ?? 0);
      const hasPrices = (prices?.priceInput ?? 0) > 0 || (prices?.priceOutput ?? 0) > 0;
      return { name, inputTokens, outputTokens, cost, hasPrices };
    });
  }, [agentInputData, agentOutputData, agentPriceMap]);

  const totals = React.useMemo(() => {
    const totalInput = chartData.reduce((s, d) => s + d.inputTokens, 0);
    const totalOutput = chartData.reduce((s, d) => s + d.outputTokens, 0);
    const totalCost = agentBreakdown.reduce((s, a) => s + a.cost, 0);
    const missingPrices = agentBreakdown.some((a) => !a.hasPrices);
    return { totalInput, totalOutput, totalCost, missingPrices };
  }, [chartData, agentBreakdown]);

  const hasData = chartData.some((d) => d.inputTokens > 0 || d.outputTokens > 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 min-w-[200px]">
          <Label>Project</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger>
              <SelectValue placeholder={projectsLoading ? "Loading…" : "Select project"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Date Range</Label>
          <DateRangeSelector
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            maxDays={90}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {selectedProject && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Input Tokens</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.totalInput)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Output Tokens</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(totals.totalOutput)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Estimated Cost</p>
            <p className="text-2xl font-bold mt-1">{formatCost(totals.totalCost)}</p>
            {totals.missingPrices && (
              <p className="text-xs text-muted-foreground mt-1">
                Some agents have no prices configured.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-lg border p-6 min-h-[280px]">
        {!selectedProject ? (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
            Select a project to view token usage and cost over time.
          </div>
        ) : loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
            No token data for this project in the selected date range.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillInput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="fillOutput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatNumber}
              />
              <ChartTooltip
                labelFormatter={(_: any, payload: any) =>
                  payload?.[0] ? format(payload[0].payload.dateObj, "PPP") : ""
                }
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) => [
                      formatNumber(Number(value)),
                      " " + String(name),
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="inputTokens"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#fillInput)"
                name="Input Tokens"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                fill="url(#fillOutput)"
                name="Output Tokens"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>

      {/* Per-agent cost breakdown */}
      {selectedProject && agentBreakdown.length > 0 && (
        <div className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">Cost breakdown by agent</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Agent</th>
                <th className="px-4 py-2 text-right font-medium">Input Tokens</th>
                <th className="px-4 py-2 text-right font-medium">Output Tokens</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {agentBreakdown.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{row.name}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.inputTokens)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(row.outputTokens)}</td>
                  <td className="px-4 py-2 text-right">
                    {row.hasPrices ? (
                      formatCost(row.cost)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
