"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { formatCurrency } from "@/lib/admin-format"
import type { MrrTrendPoint } from "@/lib/admin-metrics"

// "2026-06" → "Jun". Falls back to the raw value if it isn't a YYYY-MM string.
function shortMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number)
  if (!year || !mon) return month
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleString(undefined, { month: "short" })
}

export default function RevenueChart({ data }: { data: MrrTrendPoint[] }) {
  const hasRevenue = data.some((point) => point.mrr > 0)
  const series = data.map((point) => ({ ...point, label: shortMonth(point.month) }))

  return (
    <figure
      className="m-0 rounded-xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <figcaption className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        Monthly recurring revenue
        <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
          last 12 months
        </span>
      </figcaption>

      {!hasRevenue ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          No revenue yet. The chart fills in as paid subscriptions arrive.
        </p>
      ) : (
        <div style={{ width: "100%", height: 240 }} data-testid="revenue-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-default)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value: number) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "MRR"]}
                contentStyle={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--brand-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
