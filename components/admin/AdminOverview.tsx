"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import AdminMetrics from "@/components/admin/AdminMetrics"
import PlanBreakdown from "@/components/admin/PlanBreakdown"
import RecentActivity from "@/components/admin/RecentActivity"
import type { AdminMetrics as Metrics } from "@/lib/admin-metrics"
import type { AdminActivityRow } from "@/lib/admin-activity"

// The chart pulls in recharts (heavy, below the fold), so it's split into its own chunk
// and loaded client-side only — keeping it out of the main admin bundle.
const RevenueChart = dynamic(() => import("@/components/admin/RevenueChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[316px] w-full rounded-xl" />,
})

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; metrics: Metrics; activities: AdminActivityRow[] }

export default function AdminOverview() {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let active = true
    Promise.all([
      fetch("/api/admin/metrics").then((response) => {
        if (!response.ok) throw new Error("metrics failed")
        return response.json()
      }),
      fetch("/api/admin/activity?page=1").then((response) => {
        if (!response.ok) throw new Error("activity failed")
        return response.json()
      }),
    ])
      .then(([metrics, activity]) => {
        if (active) setState({ status: "ready", metrics, activities: activity.activities })
      })
      .catch(() => {
        if (active) setState({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [])

  if (state.status === "loading") {
    return (
      <div data-testid="overview-skeleton" className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[316px] w-full rounded-xl" />
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-xl p-4 text-sm"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
      >
        Could not load metrics. Refresh the page to try again.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <AdminMetrics metrics={state.metrics} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={state.metrics.mrrTrend12m} />
        </div>
        <PlanBreakdown planCounts={state.metrics.planCounts} />
      </div>
      <RecentActivity activities={state.activities} />
    </div>
  )
}
