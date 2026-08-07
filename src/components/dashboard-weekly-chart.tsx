"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface WeeklyChartPoint {
  name: string;
  taskCount: number;
  estimateTotal: number;
}

export function WeeklyLoadChart({ data }: { data: WeeklyChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(59, 130, 246, 0.06)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="taskCount"
          name="任务数"
          fill="hsl(221 83% 53%)"
          radius={[5, 5, 0, 0]}
          barSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}