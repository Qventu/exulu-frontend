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
import { Leaderboard } from "@/components/dashboard/leaderboard";
import {
    GET_AGENT_SESSIONS_STATISTICS,
    GET_WORKFLOW_RUNS_STATISTICS,
    GET_AGENT_RUN_STATISTICS,
    GET_FUNCTION_CALLS_STATISTICS,
    GET_TOKEN_USAGE_STATISTICS,
    GET_USER_STATISTICS,
    GET_PROJECT_STATISTICS,
    GET_AGENT_STATISTICS,
    GET_USERS_BY_IDS,
    GET_PROJECTS_BY_IDS
} from "@/queries/queries";
import { Users, Layers, Bot } from "lucide-react";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 14),
        to: new Date()
    });

    const [selectedType, setSelectedType] = useState<STATISTICS_TYPE>("AGENT_RUN");
    const [unit, setUnit] = useState<"tokens" | "count">("count");
    const [groupBy, setGroupBy] = useState<string>("label");
    const [leaderboardView, setLeaderboardView] = useState<"count" | "tokens">("count");

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
            <div className="flex-1 grid gap-6 md:grid-cols-3">
                <div className="rounded-lg border md:col-span-2 p-6 flex flex-col">
                    <TimeSeriesChart
                        dateRange={dateRange}
                        selectedType={selectedType}
                        onTypeChange={setSelectedType}
                        onUnitChange={setUnit}
                        unit={unit}
                        unitOptions={[
                            { value: 'tokens', label: 'Tokens' },
                            { value: 'count', label: 'Count' }
                        ]}
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
                        unit={leaderboardView === "count" ? "count" : "tokens"}
                        onGroupByChange={setGroupBy}
                    />
                </div>
            </div>

            {/* Leaderboards Section */}
            <div className="mt-8 mb-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold">Leaderboards</h3>
                    <div className="flex items-center gap-2 bg-secondary-foreground/10 dark:bg-secondary-foreground/20 p-1 rounded-lg">
                        <button
                            onClick={() => setLeaderboardView("count")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                leaderboardView === "count"
                                    ? "bg-white dark:bg-primary shadow-sm text-secondary"
                                    : "hover:text-primary dark:hover:text-primary"
                            }`}
                        >
                            Count
                        </button>
                        <button
                            onClick={() => setLeaderboardView("tokens")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                leaderboardView === "tokens"
                                    ? "bg-white dark:bg-primary shadow-sm text-secondary"
                                    : "hover:text-primary dark:hover:text-primary"
                            }`}
                        >
                            Tokens
                        </button>
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3 mb-5">
                    <Leaderboard
                        title="Top Users"
                        subtitle={leaderboardView === "count" ? "Most active users by agent calls" : "Most active users by token usage"}
                        query={GET_USER_STATISTICS}
                        dateRange={{
                            from: dateRange?.from || subDays(new Date(), 14),
                            to: dateRange?.to || new Date()
                        }}
                        icon={<Users className="h-5 w-5 text-blue-500" />}
                        valueLabel={leaderboardView === "count" ? "calls" : "tokens"}
                        maxEntries={10}
                        nameFilter={leaderboardView === "count" ? ["count"] : ["inputTokens", "outputTokens"]}
                        hydrationQuery={GET_USERS_BY_IDS}
                        hydrationField="userByIds"
                    />
                    <Leaderboard
                        title="Top Projects"
                        subtitle={leaderboardView === "count" ? "Most active projects by agent calls" : "Most active projects by token usage"}
                        query={GET_PROJECT_STATISTICS}
                        dateRange={{
                            from: dateRange?.from || subDays(new Date(), 14),
                            to: dateRange?.to || new Date()
                        }}
                        icon={<Layers className="h-5 w-5 text-purple-500" />}
                        valueLabel={leaderboardView === "count" ? "calls" : "tokens"}
                        maxEntries={10}
                        nameFilter={leaderboardView === "count" ? ["count"] : ["inputTokens", "outputTokens"]}
                        hydrationQuery={GET_PROJECTS_BY_IDS}
                        hydrationField="projectByIds"
                    />
                    <Leaderboard
                        title="Top Agents"
                        subtitle={leaderboardView === "count" ? "Most used agents by call count" : "Most used agents by token usage"}
                        query={GET_AGENT_STATISTICS}
                        dateRange={{
                            from: dateRange?.from || subDays(new Date(), 14),
                            to: dateRange?.to || new Date()
                        }}
                        icon={<Bot className="h-5 w-5 text-green-500" />}
                        valueLabel={leaderboardView === "count" ? "calls" : "tokens"}
                        maxEntries={10}
                        nameFilter={leaderboardView === "count" ? ["count"] : ["inputTokens", "outputTokens"]}
                    />
                </div>
            </div>
        </div>
    );
}
