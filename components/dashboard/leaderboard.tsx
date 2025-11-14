"use client";

import { DocumentNode, useQuery } from "@apollo/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { useMemo } from "react";
import { STATISTICS_TYPE } from "@/types/enums/statistics";

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
  emptyMessage = "No data available",
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

  console.log("[EXULU] IDs to hydrate:", idsToHydrate);
  console.log("[EXULU] Hydration query:", hydrationQuery);

  // Fetch names if hydration is needed
  const { data: hydrationData, loading: hydrationLoading } = useQuery(hydrationQuery || query, {
    variables: { ids: idsToHydrate },
    skip: !hydrationQuery || idsToHydrate.length === 0
  });

  console.log("[EXULU] Hydration data:", hydrationData);

  const leaderboardData = useMemo(() => {
    if (!data?.trackingStatistics) return [];

    const entries: LeaderboardEntry[] = data.trackingStatistics
      .filter((item: any) => item?.group && item?.count)
      .map((item: any) => {
        let displayName = item.group;

        // Hydrate the name if hydration data is available
        if (hydrationData && hydrationField) {
          const hydratedItem = hydrationData[hydrationField]?.find(
            (h: any) => {
              console.log("[EXULU] Hydrated item:", h);
              console.log("[EXULU] Item group:", item.group);
              if (typeof h.id === "number") {
                return h.id === parseInt(item.group);
              } else {
                return h.id === item.group;
              }
            }
          );
          if (hydratedItem) {
            // Use name, or fallback to firstname + lastname, or email
            displayName = hydratedItem.name ||
              (hydratedItem.firstname && hydratedItem.lastname
                ? `${hydratedItem.firstname} ${hydratedItem.lastname}`
                : hydratedItem.email) ||
              item.group;
          }
        }

        return {
          name: displayName,
          value: item.count
        };
      })
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, maxEntries)
      .map((item: any, index: number) => ({
        ...item,
        rank: index + 1
      }));

    return entries;
  }, [data, hydrationData, hydrationField, maxEntries]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return <span className="text-sm font-semibold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800";
      case 2:
        return "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20 border-gray-200 dark:border-gray-700";
      case 3:
        return "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800";
      default:
        return "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700";
    }
  };

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
              className={`relative overflow-hidden rounded-lg border-2 p-3 transition-all duration-300 hover:shadow-md hover:scale-105 ${getRankColor(entry.rank)}`}
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-transparent dark:from-blue-900/20 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />

              {/* Content */}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getRankIcon(entry.rank)}
                  </div>
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
