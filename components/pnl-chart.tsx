"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Generate 30 days of mock P&L data — mostly green
function generatePnlData() {
  const data = [];
  let value = 100000;
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayLabel = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    // Mostly positive days
    const change = (Math.random() - 0.35) * 3000;
    value += change;
    data.push({
      date: dayLabel,
      value: Math.round(value),
    });
  }
  return data;
}

interface PnlChartProps {
  height?: number;
  showGrid?: boolean;
}

export default function PnlChart({ height = 300, showGrid = true }: PnlChartProps) {
  const data = useMemo(() => generatePnlData(), []);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e2db" />
        )}
        <defs>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#00ff88" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e2db" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          width={55}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "13px",
            padding: "8px 12px",
          }}
          formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, "Vault Value"]}
          labelStyle={{ color: "#9ca3af", fontSize: "11px" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#00ff88"
          strokeWidth={2}
          fill="url(#greenGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
