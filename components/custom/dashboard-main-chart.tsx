"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{`${label} : ${payload[0].value}`}</p>
        <span>View jobs</span>
      </div>
    );
  }

  return null;
};

export function DashboardMainChart({ data }: { data: any[] | null }) {

  const router = useRouter();

  const handleClick = (data: any, index: number) => {
    /* todo: convert index to valid date object */
    router.push(`/jobs?dateFrom=${index}&dateTo=${index}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`
  }

  let chartData = data;
  if (!chartData) {
    chartData = [
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
      { name: "DD.MM.YYYY", total: 0 },
    ];
  }
  return <ResponsiveContainer className="px-10" width="100%" height="100%">
    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
      <defs>
        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <XAxis
        interval={0}
        dataKey="name"
        tick={{ fontSize: 12 }}
        tickMargin={10}
        axisLine={{ stroke: "#888", strokeWidth: 1 }}
        tickLine={false}
      />
      
      <Tooltip content={<CustomTooltip />} />
      <Area
        type="monotone"
        dataKey="total"
        stroke="#2563eb"
        fillOpacity={1}
        fill="url(#colorTotal)"
        strokeWidth={2}
      />
    </AreaChart>
  </ResponsiveContainer>
}
