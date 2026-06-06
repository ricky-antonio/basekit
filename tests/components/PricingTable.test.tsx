import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import PricingTable from "@/components/billing/PricingTable"

const defaultProps = {
  currentPlan: "free" as const,
  proPriceIds: {
    monthly: process.env["STRIPE_PRICE_PRO_MONTHLY"]!,
    annual: process.env["STRIPE_PRICE_PRO_ANNUAL"]!,
  },
  enterprisePriceIds: {
    monthly: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"]!,
    annual: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"]!,
  },
}

describe("PricingTable", () => {
  it("renders three plan columns", () => {
    render(<PricingTable {...defaultProps} />)
    expect(screen.getByText("Free")).toBeInTheDocument()
    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("Enterprise")).toBeInTheDocument()
  })

  it("shows 'Most popular' badge on Pro", () => {
    render(<PricingTable {...defaultProps} />)
    expect(screen.getByText("Most popular")).toBeInTheDocument()
  })

  it("monthly/annual toggle updates displayed prices", () => {
    render(<PricingTable {...defaultProps} />)

    // Default is monthly
    expect(screen.getByText("$29")).toBeInTheDocument()

    // Switch to annual
    fireEvent.click(screen.getByRole("button", { name: /annual/i }))

    // Pro annual price is $23
    expect(screen.getByText("$23")).toBeInTheDocument()
  })

  it("each plan has a CTA button", () => {
    render(<PricingTable {...defaultProps} />)
    // Free is current plan
    expect(screen.getByRole("button", { name: /current plan: free/i })).toBeInTheDocument()
    // Pro and Enterprise have upgrade buttons
    expect(screen.getByRole("button", { name: /upgrade to pro/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /upgrade to enterprise/i })).toBeInTheDocument()
  })

  it("annual toggle shows '/mo billed annually' subline", () => {
    render(<PricingTable {...defaultProps} />)

    fireEvent.click(screen.getByRole("button", { name: /annual/i }))

    // Pro and Enterprise show the annual subline
    const sublines = screen.getAllByText("/mo billed annually")
    expect(sublines.length).toBeGreaterThanOrEqual(2)
  })

  it("routes paid users to the portal instead of offering a Checkout that would 409", () => {
    render(<PricingTable {...defaultProps} currentPlan="pro" />)

    // Pro is current
    expect(screen.getByRole("button", { name: /current plan: pro/i })).toBeInTheDocument()

    // Enterprise (a different tier) does NOT offer an active upgrade — it's disabled and
    // points the user at the billing portal.
    const enterpriseCta = screen.getByRole("button", { name: /manage enterprise in the billing portal/i })
    expect(enterpriseCta).toBeDisabled()
  })

  it("dark variant uses dark surface tokens", () => {
    const { container } = render(<PricingTable {...defaultProps} variant="dark" />)
    const root = container.querySelector('[data-variant="dark"]')
    expect(root).toBeInTheDocument()
    // Cards carry fixed dark surfaces rather than the theme-reactive CSS variables.
    expect(container.querySelector('[style*="rgb(20, 20, 20)"]')).toBeInTheDocument()
  })

  it("annual toggle is default-selected and shows 'Save 20%' pill in the dark variant", () => {
    render(<PricingTable {...defaultProps} variant="dark" />)

    expect(screen.getByRole("button", { name: /annual/i })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /monthly/i })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Save 20%")).toBeInTheDocument()
    // Annual is the default, so Pro shows its annual price.
    expect(screen.getByText("$23")).toBeInTheDocument()
  })

  it("Pro card has the 'MOST POPULAR' badge", () => {
    render(<PricingTable {...defaultProps} variant="dark" />)
    expect(screen.getByText(/most popular/i)).toBeInTheDocument()
  })

  it("ctaHref turns every CTA into a signup link instead of opening Checkout", () => {
    render(<PricingTable {...defaultProps} variant="dark" ctaHref="/signup" />)
    const ctas = screen.getAllByRole("link", { name: /get started with/i })
    expect(ctas).toHaveLength(3)
    ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "/signup"))
  })
})
