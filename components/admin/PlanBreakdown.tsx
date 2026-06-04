import type { PlanName } from "@/lib/types"

interface PlanBreakdownProps {
  planCounts: Record<PlanName, number>
}

const SEGMENTS: { plan: PlanName; label: string; color: string }[] = [
  { plan: "free", label: "Free", color: "var(--text-muted)" },
  { plan: "pro", label: "Pro", color: "var(--brand-primary)" },
  { plan: "enterprise", label: "Enterprise", color: "var(--accent-indigo)" },
]

export default function PlanBreakdown({ planCounts }: PlanBreakdownProps) {
  const total = SEGMENTS.reduce((sum, { plan }) => sum + planCounts[plan], 0)
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100))

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        Plan breakdown
      </h2>

      {/* Stacked proportion bar */}
      <div
        className="mt-4 flex h-2.5 overflow-hidden rounded-full"
        style={{ background: "var(--bg-surface-hover)" }}
        role="img"
        aria-label="Distribution of workspaces across plans"
      >
        {SEGMENTS.map(({ plan, label, color }) => (
          <div
            key={plan}
            data-testid={`plan-segment-${plan}`}
            data-plan={plan}
            style={{ width: `${pct(planCounts[plan])}%`, background: color }}
            title={`${label}: ${planCounts[plan]}`}
          />
        ))}
      </div>

      {/* Legend with counts + percentages */}
      <ul className="mt-4 space-y-2">
        {SEGMENTS.map(({ plan, label, color }) => (
          <li key={plan} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
              {label}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              <span className="font-semibold">{planCounts[plan]}</span>{" "}
              <span style={{ color: "var(--text-muted)" }}>({pct(planCounts[plan])}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
