"use client"

import { subDays, formatDistanceToNow } from "date-fns";
import { useState, useContext, useEffect } from "react";
import * as React from "react";
import { DateRange } from "react-day-picker";
import { STATISTICS_TYPE, STATISTICS_TYPE_ENUM } from "@/types/enums/statistics";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { UserContext } from "@/app/(application)/authenticated";
import { useQuery } from "@apollo/client";
import { GET_CONTEXTS, GET_ITEMS, PAGINATION_POSTFIX } from "@/queries/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, FileText, Clock, Plus, ArrowLeft, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function ContextsDashboard() {
  const { user } = useContext(UserContext);
  
  const [unit, setUnit] = useState<"tokens" | "count">("count");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });

  const [selectedType, setSelectedType] = useState<STATISTICS_TYPE>("CONTEXT_UPSERT");
  const [groupBy, setGroupBy] = useState<string>("label");

  const isSuperAdmin = user?.super_admin === true;

  // Render admin dashboard for super admins
  if (isSuperAdmin) {
    return (
      <AdminDashboard
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        unit={unit}
        setUnit={setUnit}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />
    );
  }

  // Render regular user view for non-admin users
  return <RecentItemsView />;
}

// Admin Dashboard Component (original dashboard)
function AdminDashboard({
  dateRange,
  setDateRange,
  selectedType,
  setSelectedType,
  unit,
  setUnit,
  groupBy,
  setGroupBy
}: {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  selectedType: STATISTICS_TYPE;
  setSelectedType: (type: STATISTICS_TYPE) => void;
  unit: "tokens" | "count";
  setUnit: (unit: "tokens" | "count") => void;
  groupBy: string;
  setGroupBy: (groupBy: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-8 pt-6 h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold tracking-tight bg-clip-text">
            Contexts Dashboard
          </h2>
          <p className="text-lg">
            Monitor your contexts and their usage.
          </p>
        </div>

        {/* Date Range Selector - moved to header */}
        <div className="flex items-center space-x-2">
          <DateRangeSelector
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            maxDays={30}
          />
        </div>
      </div>

      {/* Charts Grid - Improved layout and spacing */}
      <div className="flex-1 grid gap-6 md:grid-cols-3 min-h-0">
        <div className="rounded-lg border md:col-span-2 p-6 flex flex-col">
          <TimeSeriesChart
            dateRange={dateRange}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            unitOptions={[
              { value: 'count', label: 'Count' }
          ]}
            onUnitChange={setUnit}
            unit={unit}
            dataTypes={[
              STATISTICS_TYPE_ENUM.CONTEXT_RETRIEVE,
              // STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT,
              // STATISTICS_TYPE_ENUM.EMBEDDER_GENERATE,
              // STATISTICS_TYPE_ENUM.EMBEDDER_DELETE,
              STATISTICS_TYPE_ENUM.CONTEXT_UPSERT
            ]}
          />
        </div>
        <div className="rounded-lg border p-6 flex flex-col">
          <DonutChart
            groupByOptions={[]}
            dateRange={dateRange}
            selectedType={selectedType}
            unit={unit}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
          />
        </div>
      </div>
    </div>
  );
}

// Recent Items View for regular users
function RecentItemsView() {
  const router = useRouter();
  const [hasAnyItems, setHasAnyItems] = useState<boolean | null>(null);

  // Get all contexts
  const { data: contextsData, loading: contextsLoading } = useQuery(GET_CONTEXTS);

  const contexts = contextsData?.contexts?.items || [];

  // Track if we've checked all contexts and found no items
  const handleItemsCheck = (contextHasItems: boolean) => {
    if (contextHasItems && hasAnyItems === null) {
      setHasAnyItems(true);
    }
  };

  // After loading, if we haven't found any items, set to false
  React.useEffect(() => {
    if (!contextsLoading && contexts.length > 0 && hasAnyItems === null) {
      // Give components time to load
      const timer = setTimeout(() => {
        if (hasAnyItems === null) {
          setHasAnyItems(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [contextsLoading, contexts.length, hasAnyItems]);

  return (
    <div className="flex-1 flex flex-col p-8 pt-6 h-screen overflow-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold tracking-tight bg-clip-text">
            Recent Items
          </h2>
          <p className="text-lg text-muted-foreground">
            Browse recent items across all your knowledge sources.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {contextsLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state - no contexts */}
      {!contextsLoading && contexts.length === 0 && (
        <EmptyStateNoContexts />
      )}

      {/* Empty state - no items */}
      {!contextsLoading && contexts.length > 0 && hasAnyItems === false && (
        <EmptyStateNoItems />
      )}

      {/* Contexts with recent items */}
      {!contextsLoading && contexts.length > 0 && hasAnyItems !== false && (
        <div className="space-y-6">
          {contexts.map((context: any) => (
            <ContextRecentItems
              key={context.id}
              context={context}
              router={router}
              onItemsFound={handleItemsCheck}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Component to display recent items for a single context
function ContextRecentItems({
  context,
  router,
  onItemsFound
}: {
  context: any;
  router: any;
  onItemsFound?: (hasItems: boolean) => void;
}) {
  const { data: raw, loading } = useQuery(GET_ITEMS(context.id, []), {
    variables: {
      page: 1,
      limit: 5,
      filters: [],
    },
    skip: !context.slug,
  });

  const data: {
    items: any;
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  } = raw?.[context.id + PAGINATION_POSTFIX] as any;

  const items = data?.items || [];

  // Notify parent when items are found
  useEffect(() => {
    if (!loading && items.length > 0 && onItemsFound) {
      onItemsFound(true);
    }
  }, [loading, items.length, onItemsFound]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return null; // Don't show contexts with no items
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>{context.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {items.length} recent
          </Badge>
        </div>
        {context.description && (
          <CardDescription>{context.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item: any) => (
            <div
              key={item.id}
              onClick={() => router.push(`/data/${context.id}/${item.id}`)}
              className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {item.name || item.external_id || "Untitled"}
                    </h4>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 ml-6">
                    {item.updatedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {item.chunks_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {item.chunks_count} chunks
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Empty State when no contexts exist
function EmptyStateNoContexts() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-2xl w-full border-dashed">
        <CardContent className="py-16 px-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon Group */}
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" />
              <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-primary/10">
                <Database className="h-12 w-12 text-primary" />
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">No Knowledge Sources Yet</h3>
              <p className="text-muted-foreground max-w-md text-base">
                Knowledge sources help you organize and search through your data. Get started by creating your first knowledge source.
              </p>
            </div>

            {/* Instructions */}
            <div className="pt-4 space-y-3 text-left w-full max-w-md">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="mt-0.5">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    1
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Navigate to Knowledge Sources</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Find "Knowledge Sources" in the sidebar on the left
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="mt-0.5">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    2
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Create a Knowledge Source</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the "+" button to set up a new knowledge source
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Empty State when contexts exist but no items
function EmptyStateNoItems() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full border-dashed">
        <CardContent className="py-16 px-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon Group with animated elements */}
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full animate-pulse" />
              <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10">
                <div className="absolute top-2 right-2">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <FileText className="h-12 w-12 text-primary" />
              </div>
            </div>

            {/* Text Content */}
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold">Ready to Add Your First Items?</h3>
              <p className="text-muted-foreground max-w-md text-base">
                Your knowledge sources are set up! Now it's time to populate them with data. Items will appear here once added.
              </p>
            </div>

            {/* Visual Guide */}
            <div className="pt-4 space-y-4 text-left w-full max-w-md">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20">
                <div className="mt-0.5">
                  <ArrowLeft className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Look in the sidebar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Navigate to <span className="font-semibold text-foreground">Knowledge Sources</span> on the left to add items to your sources
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium">Add Items</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload files or add data to your sources
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium">Organize</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Structure your knowledge for easy access
                  </p>
                </div>
              </div>
            </div>

            {/* Optional CTA */}
            <div className="pt-2">
              <Button
                onClick={() => router.push('/data')}
                className="gap-2"
                size="lg"
              >
                <Database className="h-4 w-4" />
                Go to Knowledge Sources
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}