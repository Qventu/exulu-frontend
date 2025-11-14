"use client"

import { subDays } from "date-fns";
import * as React from "react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { STATISTICS_TYPE, STATISTICS_TYPE_ENUM } from "@/types/enums/statistics";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";

export const dynamic = "force-dynamic";

export default function ContextsDashboard() {
  
  const [unit, setUnit] = useState<"tokens" | "count">("count");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });

  const [selectedType, setSelectedType] = useState<STATISTICS_TYPE>("CONTEXT_UPSERT");
  const [groupBy, setGroupBy] = useState<string>("label");

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