import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import PlanBreakdown from "@/components/admin/PlanBreakdown"

describe("PlanBreakdown", () => {
  it("renders 3 segments with widths proportional to the counts", () => {
    render(<PlanBreakdown planCounts={{ free: 50, pro: 30, enterprise: 20 }} />)
    expect(screen.getByTestId("plan-segment-free")).toHaveStyle({ width: "50%" })
    expect(screen.getByTestId("plan-segment-pro")).toHaveStyle({ width: "30%" })
    expect(screen.getByTestId("plan-segment-enterprise")).toHaveStyle({ width: "20%" })
  })

  it("shows counts and percentages in the legend", () => {
    render(<PlanBreakdown planCounts={{ free: 50, pro: 30, enterprise: 20 }} />)
    expect(screen.getByText("(50%)")).toBeInTheDocument()
    expect(screen.getByText("(30%)")).toBeInTheDocument()
    expect(screen.getByText("(20%)")).toBeInTheDocument()
  })

  it("renders 0% segments without dividing by zero when there are no users", () => {
    render(<PlanBreakdown planCounts={{ free: 0, pro: 0, enterprise: 0 }} />)
    expect(screen.getByTestId("plan-segment-free")).toHaveStyle({ width: "0%" })
    expect(screen.getAllByText("(0%)")).toHaveLength(3)
  })
})
