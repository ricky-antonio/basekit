import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import MarketingNav from "@/components/marketing/MarketingNav"

describe("MarketingNav", () => {
  it("renders wordmark and primary links", () => {
    render(<MarketingNav />)
    expect(screen.getByLabelText("basekit home")).toBeInTheDocument()
    // Each primary link appears in both the desktop bar and the (hidden) mobile drawer
    // is only rendered on open — so before opening, each appears once.
    expect(screen.getByRole("link", { name: "Features" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument()
  })

  it("collapses to a hamburger toggle that opens a mobile menu", () => {
    render(<MarketingNav />)
    const toggle = screen.getByRole("button", { name: /open menu/i })
    expect(toggle).toBeInTheDocument()

    fireEvent.click(toggle)
    // After opening, the toggle flips to "Close menu" and the links duplicate into the drawer.
    expect(screen.getByRole("button", { name: /close menu/i })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Pricing" }).length).toBeGreaterThanOrEqual(2)
  })

  it("is sticky on scroll", () => {
    const { container } = render(<MarketingNav />)
    const header = container.querySelector("header")
    expect(header).toHaveClass("sticky")
  })
})
