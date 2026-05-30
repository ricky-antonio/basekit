import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import UsageBar from "@/components/billing/UsageBar"

describe("UsageBar", () => {
  it("renders 'used / total' format", () => {
    render(<UsageBar label="Projects" used={2} maxCount={3} />)
    expect(screen.getByText("2 / 3")).toBeInTheDocument()
    expect(screen.getByText("Projects")).toBeInTheDocument()
  })

  it("bar width equals (used/total)*100 percent via aria attributes", () => {
    render(<UsageBar label="Projects" used={2} maxCount={3} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "2")
    expect(bar).toHaveAttribute("aria-valuemax", "3")
  })

  it("renders 'Unlimited' when maxCount is null", () => {
    render(<UsageBar label="Projects" used={10} maxCount={null} />)
    expect(screen.getByText("Unlimited")).toBeInTheDocument()
  })

  it("renders 'full' (danger) bar state at 100%", () => {
    render(<UsageBar label="Projects" used={3} maxCount={3} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("data-state", "full")
    expect(bar).toHaveStyle({ backgroundColor: "var(--danger-solid)" })
  })

  it("renders 'warning' bar state at >= 80%", () => {
    render(<UsageBar label="Projects" used={80} maxCount={100} />)
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("data-state", "warning")
    expect(bar).toHaveStyle({ backgroundColor: "var(--warning-solid)" })
  })
})
