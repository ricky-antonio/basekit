import { formatCurrency, formatPercent } from "@/lib/admin-format"
import type { AdminMetrics as Metrics } from "@/lib/admin-metrics"

interface MetricCard {
  label: string
  value: string
  hint: string
  accent: string
}

// Accent colors map to the metric semantics from design.md: revenue = brand teal,
// users = indigo, active subscribers = success green, churn = rose/danger.
function cards(metrics: Metrics): MetricCard[] {
  return [
    {
      label: "MRR",
      value: formatCurrency(metrics.mrr),
      hint: `${formatCurrency(metrics.arr)} ARR`,
      accent: "var(--brand-primary)",
    },
    {
      label: "Total users",
      value: String(metrics.totalUsers),
      hint: `${metrics.activeSubscribers} paying`,
      accent: "var(--accent-indigo)",
    },
    {
      label: "Active subscribers",
      value: String(metrics.activeSubscribers),
      hint: `${formatPercent(metrics.trialConversionRate)} trial conversion`,
      accent: "var(--success-text)",
    },
    {
      label: "Churn (30d)",
      value: formatPercent(metrics.churnRate30d),
      hint: "Canceled in last 30 days",
      accent: "var(--danger-solid)",
    },
  ]
}

export default function AdminMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards(metrics).map((card) => (
        <div
          key={card.label}
          data-testid="metric-card"
          className="rounded-xl p-5"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderLeft: `3px solid ${card.accent}`,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {card.value}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {card.hint}
          </p>
        </div>
      ))}
    </div>
  )
}
