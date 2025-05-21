"use client";

import { addDays } from "date-fns";
import * as React from "react";
import { useEffect, useState } from "react";
import { CalendarDateRangePicker } from "@/components/custom/date-range-picker";
import { DashboardMainChart } from "@/components/custom/dashboard-main-chart";
import { RecentJobs } from "@/components/custom/recent-jobs";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JOB_STATUS } from "@/util/enums/job-status";
import { STATISTICS_TYPE, STATISTICS_TYPE_ENUM } from "@EXULU_SHARED/enums/statistics";
import { statistics } from "@/util/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Totals = Record<STATISTICS_TYPE, number | null>

export default function DashboardPage() {

    const [currentData, setCurrentData] = useState<Totals | null>(null);
    const [chartData, setChartData] = useState<{ name: string, count: number }[] | null>(null);
    const [compareData, setCompareData] = useState<Totals | null>(null);
    const [mode, setMode] = useState<STATISTICS_TYPE>(STATISTICS_TYPE_ENUM.AGENT_RUN as STATISTICS_TYPE);
    const [date, setDate] = useState<{ from: Date; to: Date }>({
        from: addDays(new Date(), -7),
        to: new Date(),
    });

    const getCurrentData = async () => {
        const response = await statistics.get.totals({
            type: mode,
            from: date.from,
            to: date.to,
        })
        const { data } = await response.json()
        console.log("Get current data response", data)
        setCurrentData(data);
    };

    const getCompareData = async () => {
        const response = await statistics.get.totals({
            type: mode,
            from: addDays(date.from, -14),
            to: addDays(date.to, -7),
        });
        const { data } = await response.json()
        console.log("Get compare data response", data)
        setCompareData(data);
    };

    const getChartData = async () => {
        const response = await statistics.get.timeseries({
            type: mode,
            from: date.from,
            to: date.to,
        });
        const { data } = await response.json()
        console.log("Get time series data response", data)
        setChartData(data ? data.map((item: any) => ({ name: format(item.date, "dd.MM.yyyy"), total: item.count })) : []);
    }

    useEffect(() => {
        getCurrentData();
        getCompareData();
        getChartData();
    }, []);

    useEffect(() => {
        getCurrentData();
        getCompareData();
        getChartData();
    }, [date, mode]);

    return (
        /* todo: empty states */
        <>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <div className="flex items-center space-x-2">
                        <CalendarDateRangePicker
                            defaultDate={date}
                            onValueChange={(value: { from: Date; to: Date }) => {
                                if (!value) {
                                    return;
                                }
                                setDate(value);
                            }}
                        />
                        {/* todo: set query to update chart */}
                        {/* todo: add button "view jobs" that allows transfering this filter to the jobs page */}
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Agent sessions
                            </CardTitle>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                className="size-4 text-muted-foreground"
                            >
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {currentData?.[STATISTICS_TYPE_ENUM.AGENT_RUN] === undefined ? (
                                    <Skeleton className="w-[30%] h-[32px] rounded-lg mb-2" />
                                ) : (
                                    currentData[STATISTICS_TYPE_ENUM.AGENT_RUN]
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {compareData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]! >= currentData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]! && <span>+</span>}
                                {currentData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]! === 0 ? 0 : 
                                    ((compareData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]! - currentData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]!) / currentData?.[STATISTICS_TYPE_ENUM.AGENT_RUN]!) * 100}% growth compared to previous 7 days
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Workflow sessions
                            </CardTitle>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                className="size-4 text-muted-foreground"
                            >
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {currentData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN] === undefined ? (
                                    <Skeleton className="w-[30%] h-[32px] rounded-lg mb-2" />
                                ) : (
                                    currentData[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {compareData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]! >= currentData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]! && <span>+</span>}
                                {currentData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]! === 0 ? 0 : 
                                    ((compareData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]! - currentData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]!) / currentData?.[STATISTICS_TYPE_ENUM.WORKFLOW_RUN]!) * 100}% growth compared to previous 7 days
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Embeddings generated
                            </CardTitle>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                className="size-4 text-muted-foreground"
                            >
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </CardHeader>
                        <CardContent>

                            <div className="text-2xl font-bold">
                                {currentData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT] === undefined ? (
                                    <Skeleton className="w-[30%] h-[32px] rounded-lg mb-2" />
                                ) : (
                                    currentData[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                {compareData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]! >= currentData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]! && <span>+</span>}
                                {currentData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]! === 0 ? 0 : 
                                    ((compareData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]! - currentData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]!) / currentData?.[STATISTICS_TYPE_ENUM.EMBEDDER_UPSERT]!) * 100}% growth compared to previous 7 days
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Function calls
                            </CardTitle>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                className="size-4 text-muted-foreground"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {currentData?.[STATISTICS_TYPE_ENUM.TOOL_CALL] === undefined ? (
                                    <Skeleton className="w-[30%] h-[32px] rounded-lg mb-2" />
                                ) : (
                                    currentData[STATISTICS_TYPE_ENUM.TOOL_CALL]
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {compareData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]! >= currentData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]! && <span>+</span>}
                                {currentData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]! === 0 ? 0 : 
                                    ((compareData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]! - currentData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]!) / currentData?.[STATISTICS_TYPE_ENUM.TOOL_CALL]!) * 100}% growth compared to previous 7 days
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="md:col-span-4 lg:col-span-4">
                        <CardHeader>
                            <div className="flex flex-row items-center w-full">
                                <Button onClick={() => {
                                    setMode("agent.run");
                                }}
                                    className={cn(
                                        "mr-2 col-span-1",
                                        mode === "agent.run" && "bg-primary text-primary-foreground"
                                    )}
                                    variant="outline" >
                                    Agent runs
                                </Button>

                                <Button onClick={() => {
                                    setMode("workflow.run");
                                }}
                                    className={cn(
                                        "mr-2 col-span-1",
                                        mode === "workflow.run" && "bg-primary text-primary-foreground"
                                    )}
                                    variant="outline">
                                    Workflow runs
                                </Button>

                                <Button onClick={() => {
                                    setMode("context.retrieve");
                                }}
                                    className={cn(
                                        "mr-2 col-span-1",
                                        mode === "context.retrieve" && "bg-primary text-primary-foreground"
                                    )}
                                    variant="outline" >
                                    Context retrievals
                                </Button>

                                <Button onClick={() => {
                                    setMode("embedder.upsert");
                                }}
                                    className={cn(
                                        "mr-2 col-span-1",
                                        mode === "embedder.upsert" && "bg-primary text-primary-foreground"
                                    )}
                                    variant="outline" >
                                    Context updates
                                </Button>

                                <Button onClick={() => {
                                    setMode("tool.call");
                                }}
                                    className={cn(
                                        "mr-2 col-span-1",
                                        mode === "tool.call" && "bg-primary text-primary-foreground"
                                    )}
                                    variant="outline">
                                    Tool calls
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="h-[600px]">
                            <DashboardMainChart data={chartData} />
                        </CardContent>

                    </Card>
                    <div className="md:col-span-4 lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent jobs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RecentJobs
                                    statusses={[
                                        JOB_STATUS.completed,
                                        JOB_STATUS.active,
                                        JOB_STATUS.waiting,
                                        JOB_STATUS.delayed,
                                        JOB_STATUS.paused
                                    ].join(",")}
                                />
                            </CardContent>
                        </Card>
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle>Jobs with errors</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RecentJobs
                                    statusses={[
                                        JOB_STATUS.failed
                                    ].join(",")}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
