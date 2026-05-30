import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import BillingCard from "@/components/billing/BillingCard"
import type { Subscription } from "@/lib/subscription"

const mockSubscription: Subscription = {
  id: "sub-row-1",
  workspace_id: "ws-123",
  plan_name: "pro",
  status: "active",
  stripe_customer_id: "cus_test",
  stripe_subscription_id: "sub_test",
  stripe_price_id: process.env["STRIPE_PRICE_PRO_MONTHLY"]!,
  cancel_at_period_end: false,
  current_period_start: "2024-01-01T00:00:00+00:00",
  current_period_end: "2024-02-01T00:00:00+00:00",
  trial_end: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

describe("BillingCard", () => {
  it("renders current plan name and price", () => {
    render(<BillingCard activePlan="pro" subscription={mockSubscription} />)
    expect(screen.getByText("Current plan")).toBeInTheDocument()
    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("$29/mo")).toBeInTheDocument()
  })

  it("renders trial countdown when status is trialing", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))

    const sub: Subscription = {
      ...mockSubscription,
      status: "trialing",
      trial_end: "2024-01-08T00:00:00+00:00",
    }

    render(<BillingCard activePlan="pro" subscription={sub} />)
    expect(screen.getByText(/trial ends in 7 days/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it("renders 'Cancels on <date>' when cancel_at_period_end is true", () => {
    const sub: Subscription = {
      ...mockSubscription,
      cancel_at_period_end: true,
      current_period_end: "2024-03-15T00:00:00+00:00",
    }

    render(<BillingCard activePlan="pro" subscription={sub} />)
    // Check the container div includes the cancel date message (date varies by timezone)
    const cancelText = screen.getByText(/Cancels on/)
    expect(cancelText.closest("div")).toHaveTextContent(/Cancels on .+ 2024/)
  })
})
