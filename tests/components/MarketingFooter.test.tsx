import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import MarketingFooter from "@/components/marketing/MarketingFooter"

describe("MarketingFooter", () => {
  it("renders three columns with named links", () => {
    render(<MarketingFooter />)
    expect(screen.getByRole("heading", { name: "Product" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Resources" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Company" })).toBeInTheDocument()

    // Named links within the footer columns
    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Changelog" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Privacy" })).toBeInTheDocument()
  })

  it("theme toggle is keyboard-accessible", () => {
    render(<MarketingFooter />)
    const toggle = screen.getByRole("button", { name: /mode/i })
    // A native <button> is reachable and operable by keyboard
    expect(toggle.tagName).toBe("BUTTON")
    expect(toggle).not.toBeDisabled()
  })
})
