"use client";

import { DocumentNode, useQuery } from "@apollo/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { useMemo } from "react";
import { STATISTICS_TYPE } from "@/lib/enums/statistics";

interface LeaderboardEntry {
  name: string;
  value: number;
  rank: number;
}

interface LeaderboardProps {
  title: string;
  query: DocumentNode;
  type?: STATISTICS_TYPE;
  dateRange: { from: Date; to: Date };
  icon?: React.ReactNode;
  subtitle?: string;
  valueLabel?: string;
  emptyMessage?: string;
  maxEntries?: number;
  nameFilter?: string | string[];
  hydrationQuery?: DocumentNode;
  hydrationField?: string;
}

export function Leaderboard({
  title,
  query,
  type,
  dateRange,
  icon,
  subtitle,
  valueLabel = "calls",
  emptyMessage = "No data available.",
  maxEntries = 10,
  nameFilter,
  hydrationQuery,
  hydrationField
}: LeaderboardProps) {
  const dates = useMemo(() => ({
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString()
  }), [dateRange]);

  // Build query variables based on query type and filters
  const queryVariables = useMemo(() => {
    const baseVars = {
      from: dates.from,
      to: dates.to
    };

    // Add names filter if provided (for user/project/agent statistics)
    if (nameFilter) {
      return {
        ...baseVars,
        names: Array.isArray(nameFilter) ? nameFilter : [nameFilter]
      };
    }

    // Add type if provided (for other statistics)
    return type ? { ...baseVars, type } : baseVars;
  }, [dates.from, dates.to, type, nameFilter]);

  const { data, loading } = useQuery(query, {
    variables: queryVariables
  });

  // Extract IDs for hydration
  const idsToHydrate = useMemo(() => {
    if (!data?.trackingStatistics || !hydrationQuery) return [];

    return data.trackingStatistics
      .filter((item: any) => item?.group && item?.count)
      .map((item: any) => item.group)
      .slice(0, maxEntries);
  }, [data, maxEntries, hydrationQuery]);

  // Fetch names if hydration is needed
  const { data: hydrationData, loading: hydrationLoading } = useQuery(hydrationQuery || query, {
    variables: { ids: idsToHydrate },
    skip: !hydrationQuery || idsToHydrate.length === 0
  });

  const leaderboardData = useMemo(() => {
    if (!data?.trackingStatistics) return [];

    // First, sort and slice to get the top entries
    const topEntries = data.trackingStatistics
      .filter((item: any) => item?.group && item?.count)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, maxEntries);

    // Then map and hydrate only those top entries
    const entries: LeaderboardEntry[] = topEntries
      .map((item: any, index: number) => {
        let displayName = item.group;

        // Hydrate the name if hydration data is available
        if (hydrationData && hydrationField) {
          const hydratedItem = hydrationData[hydrationField]?.find(
            (h: any) => {
              if (typeof h.id === "number") {
                return h.id === parseInt(item.group);
              } else {
                return h.id === item.group;
              }
            }
          );
          if (hydratedItem) {
            // Use name, or fallback to firstname + lastname, or email
            displayName = hydratedItem.email ||
              (hydratedItem.firstname && hydratedItem.lastname
                ? `${hydratedItem.firstname} ${hydratedItem.lastname}`
                : hydratedItem.name) ||
              item.group;
          }
        }

        return {
          name: displayName,
          value: item.count,
          rank: index + 1
        };
      });

    return entries;
  }, [data, hydrationData, hydrationField, maxEntries]);

  if (loading || (hydrationQuery && hydrationLoading)) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-auto">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!leaderboardData.length) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = leaderboardData[0]?.value || 1;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-auto">
        {leaderboardData.map((entry) => {
          const percentage = (entry.value / maxValue) * 100;

          return (
            <div
              key={entry.name}
              className={`relative overflow-hidden rounded-lg border p-3 transition-all duration-300 hover:shadow-lg`}
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-transparent dark:from-blue-900/20 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />

              {/* Content */}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" title={entry.name}>
                      {entry.name}
                    </p>
                    {entry.rank <= 3 && (
                      <p className="text-xs text-muted-foreground">
                        {entry.rank === 1 ? "Top performer" : entry.rank === 2 ? "Runner up" : "Third place"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {entry.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {valueLabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
