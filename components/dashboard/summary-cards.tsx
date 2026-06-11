"use client";

import { DocumentNode, useQuery } from "@apollo/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, subHours } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";

interface SummaryCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  isLoading?: boolean;
}

function SummaryCardElement({ title, currentValue, previousValue, isLoading }: SummaryCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className="p-2 rounded-full bg-muted">
            <div className="h-4 w-4 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-3" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentageChange = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = percentageChange > 0;
  const isNeutral = percentageChange === 0;

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isNeutral ? "text-muted-foreground" : isPositive ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500";

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-full ${isNeutral ? 'bg-muted' : isPositive ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-red-500/10 dark:bg-red-500/20'}`}>
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground mb-2">
          {currentValue.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className={`font-medium ${trendColor}`}>
            {isNeutral ? "No change" : `${Math.abs(percentageChange).toFixed(1)}% ${isPositive ? "increase" : "decrease"}`}
          </span>
          <br />
          <span className="text-muted-foreground/70">
            vs 7-day avg: {previousValue.toLocaleString()}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

export function SummaryCard({
  query,
  entity,
  title
}: {
  query: DocumentNode,
  entity: "agent_sessions" | "jobs" | "tracking",
  title: string
}) {
  // Stabilize dates to prevent constant re-renders
  const dates = useMemo(() => {
    const now = new Date();
    return {
      now: now.toISOString(),
      twentyFourHoursAgo: subHours(now, 24).toISOString(),
      sevenDaysAgo: subDays(now, 7).toISOString()
    };
  }, []); // Empty dependency array means this only runs once

  // 24h data
  const { data: data24h, loading: loading24h } = useQuery(query, {
    variables: { from: dates.twentyFourHoursAgo, to: dates.now }
  });

  // 7-day data (for average calculation)
  const { data: data7d, loading: loading7d } = useQuery(query, {
    variables: { from: dates.sevenDaysAgo, to: dates.now }
  });


  // Calculate totals
  const getTotal = (data: any) => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
  };

  const twentyFourHourTotal = getTotal(data24h?.[`${entity}Statistics`]);

  // Calculate 7-day averages (divide by 7 for daily average)
  const sevenDayAverage = Math.round(getTotal(data7d?.[`${entity}Statistics`]) / 7);

  const isLoading = loading24h || loading7d;

  return (
      <SummaryCardElement
        title={`${title} (24h)`}
        currentValue={twentyFourHourTotal}
        previousValue={sevenDayAverage}
        isLoading={isLoading}
      />
  );
}