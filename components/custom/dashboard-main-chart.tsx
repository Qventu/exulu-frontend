"use client";

import * as React from "react";
import {
  ResponsiveContainer, Tooltip, XAxis, Area, AreaChart
} from "recharts"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="label">{`${label} : ${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
};

export function DashboardMainChart({ data }: { data: any[] | null }) {

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
