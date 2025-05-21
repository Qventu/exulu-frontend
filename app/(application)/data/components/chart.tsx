"use client"

import { ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts"

export default function EmbeddingChart({ jobs }: { jobs: {
  date: string,
  count: number
}[] }) {


  if (jobs?.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }
  const data = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateStr = date.toISOString().split('T')[0];
    const job = jobs.find(j => j.date === dateStr);
    return {
      date: dateStr,
      embeddings: job ? job.count : 0,
    };
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-md shadow-sm p-2 text-sm">
          <p className="font-medium">{formatDate(label)}</p>
          <p className="text-primary">Embedding jobs: {payload[0].value}</p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="colorEmbeddings" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorRetrievals" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 12 }}
          tickMargin={10}
          axisLine={{ stroke: "#888", strokeWidth: 1 }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 12 }} tickMargin={10} axisLine={{ stroke: "#888", strokeWidth: 1 }} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="embeddings"
          stroke="#2563eb"
          fillOpacity={1}
          fill="url(#colorEmbeddings)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="retrievals"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorRetrievals)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
