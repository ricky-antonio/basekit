import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminMetrics from "@/components/admin/AdminMetrics"
import type { AdminMetrics as Metrics } from "@/lib/admin-metrics"

const metrics: Metrics = {
  mrr: 1200,
  arr: 14400,
  totalUsers: 42,
  activeSubscribers: 10,
  planCounts: { free: 32, pro: 8, enterprise: 2 },
  churnRate30d: 0.25,
  trialConversionRate: 0.5,
  mrrTrend12m: [],
}

describe("AdminMetrics", () => {
  it("renders 4 metric cards", () => {
    render(<AdminMetrics metrics={metrics} />)
    expect(screen.getAllByTestId("metric-card")).toHaveLength(4)
  })

  it("formats MRR as currency", () => {
    render(<AdminMetrics metrics={metrics} />)
    expect(screen.getByText("$1,200")).toBeInTheDocument()
    expect(screen.getByText("$14,400 ARR")).toBeInTheDocument()
  })

  it("formats churn as a percentage", () => {
    render(<AdminMetrics metrics={metrics} />)
    expect(screen.getByText("25.0%")).toBeInTheDocument()
  })
})
