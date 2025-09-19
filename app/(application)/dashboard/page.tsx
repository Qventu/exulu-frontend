"use client";

import { subDays } from "date-fns";
import * as React from "react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { STATISTICS_TYPE, STATISTICS_TYPE_ENUM } from "@/types/enums/statistics";
import { SummaryCard } from "@/components/dashboard/summary-cards";
import { DateRangeSelector } from "@/components/dashboard/date-range-selector";
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import {
    GET_AGENT_SESSIONS_STATISTICS,
    GET_WORKFLOW_RUNS_STATISTICS,
    GET_AGENT_RUN_STATISTICS,
    GET_FUNCTION_CALLS_STATISTICS,
    GET_TOKEN_USAGE_STATISTICS
} from "@/queries/queries";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 14),
        to: new Date()
    });

    const [selectedType, setSelectedType] = useState<STATISTICS_TYPE>("AGENT_RUN");
    const [unit, setUnit] = useState<"tokens" | "count">("count");
    const [groupBy, setGroupBy] = useState<string>("label");

    return (
        <div className="flex-1 flex flex-col p-8 pt-6 h-screen">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8">
                <div className="space-y-2">
                    <h2 className="text-4xl font-bold tracking-tight bg-clip-text">
                        Analytics Dashboard
                    </h2>
                    <p className="text-lg">
                        Monitor your AI workflows and performance metrics.
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

            {/* Summary Cards - Enhanced with better spacing */}
            <div className="mb-8">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <SummaryCard query={GET_AGENT_SESSIONS_STATISTICS} entity="agent_sessions" title="Agent Sessions" />
                    <SummaryCard query={GET_AGENT_RUN_STATISTICS} entity="tracking" title="Agent Calls" />
                    <SummaryCard query={GET_TOKEN_USAGE_STATISTICS} entity="tracking" title="Token Usage" />
                    <SummaryCard query={GET_WORKFLOW_RUNS_STATISTICS} entity="jobs" title="Workflow Runs" />
                    <SummaryCard query={GET_FUNCTION_CALLS_STATISTICS} entity="tracking" title="Function Calls" />
                </div>
            </div>

            {/* Charts Grid - Improved layout and spacing */}
            <div className="flex-1 grid gap-6 md:grid-cols-3 min-h-0">
                <div className="rounded-lg border md:col-span-2 p-6 flex flex-col">
                    <TimeSeriesChart
                        dateRange={dateRange}
                        selectedType={selectedType}
                        onTypeChange={setSelectedType}
                        onUnitChange={setUnit}
                        unit={unit}
                        dataTypes={[
                            STATISTICS_TYPE_ENUM.CONTEXT_RETRIEVE,
                            STATISTICS_TYPE_ENUM.SOURCE_UPDATE,
                            STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT,
                            STATISTICS_TYPE_ENUM.EMBEDDER_GENERATE,
                            STATISTICS_TYPE_ENUM.EMBEDDER_DELETE,
                            STATISTICS_TYPE_ENUM.WORKFLOW_RUN,
                            STATISTICS_TYPE_ENUM.CONTEXT_UPSERT,
                            STATISTICS_TYPE_ENUM.TOOL_CALL,
                            STATISTICS_TYPE_ENUM.AGENT_RUN
                        ]}
                    />
                </div>
                <div className="rounded-lg border p-6 flex flex-col">
                    <DonutChart
                        groupByOptions={[
                            { value: 'label', label: 'Label' },
                            { value: 'user', label: 'User' },
                            { value: 'role', label: 'Role' }
                        ]}
                        dateRange={dateRange}
                        selectedType={selectedType}
                        groupBy={groupBy}
                        onGroupByChange={setGroupBy}
                    />
                </div>
            </div>
        </div>
    );
}
