import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import RevenueChart from "@/components/admin/RevenueChart"
import type { MrrTrendPoint } from "@/lib/admin-metrics"

function trend(values: number[]): MrrTrendPoint[] {
  return values.map((mrr, index) => ({ month: `2026-${String(index + 1).padStart(2, "0")}`, mrr }))
}

describe("RevenueChart", () => {
  it("always renders the caption", () => {
    render(<RevenueChart data={trend([0, 0, 0])} />)
    expect(screen.getByText("Monthly recurring revenue")).toBeInTheDocument()
  })

  it("shows an empty state when there is no revenue (even with data points)", () => {
    render(<RevenueChart data={trend([0, 0, 0])} />)
    expect(screen.getByText(/No revenue yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId("revenue-chart")).not.toBeInTheDocument()
  })

  it("renders the chart container when there is revenue", () => {
    render(<RevenueChart data={trend([0, 12, 52])} />)
    expect(screen.queryByText(/No revenue yet/i)).not.toBeInTheDocument()
    expect(screen.getByTestId("revenue-chart")).toBeInTheDocument()
  })

  it("does not crash on an empty dataset", () => {
    render(<RevenueChart data={[]} />)
    expect(screen.getByText(/No revenue yet/i)).toBeInTheDocument()
  })
})
