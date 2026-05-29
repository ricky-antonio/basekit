import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockStripe, mockStripeSessionsCreate, resetStripeMock } from "@/tests/mocks/stripe"

vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))

const mocks = vi.hoisted(() => ({ getOrCreateStripeCustomer: vi.fn() }))
vi.mock("@/lib/billing", () => ({ getOrCreateStripeCustomer: mocks.getOrCreateStripeCustomer }))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { createCheckoutSession } from "@/lib/stripe/checkout"

const params = { workspaceId: "ws-1", priceId: "price_pro_monthly_test", userEmail: "a@b.co" }

beforeEach(() => {
  resetStripeMock()
  mocks.getOrCreateStripeCustomer.mockReset()
  vi.clearAllMocks()
})

describe("createCheckoutSession", () => {
  it("returns the checkout URL on success", async () => {
    mocks.getOrCreateStripeCustomer.mockResolvedValue({ ok: true, data: "cus_1" })
    mockStripeSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s/1" })

    const result = await createCheckoutSession(params)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe("https://checkout.stripe.com/s/1")
  })

  it("stamps workspaceId on both session and subscription metadata", async () => {
    mocks.getOrCreateStripeCustomer.mockResolvedValue({ ok: true, data: "cus_1" })
    mockStripeSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s/1" })

    await createCheckoutSession(params)

    expect(mockStripeSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        metadata: { workspaceId: "ws-1" },
        subscription_data: { metadata: { workspaceId: "ws-1" } },
        line_items: [{ price: "price_pro_monthly_test", quantity: 1 }],
      }),
    )
  })

  it("propagates the customer error when getOrCreateStripeCustomer fails", async () => {
    mocks.getOrCreateStripeCustomer.mockResolvedValue({
      ok: false,
      error: { error: "nope", code: "INTERNAL_ERROR" },
    })

    const result = await createCheckoutSession(params)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
    expect(mockStripeSessionsCreate).not.toHaveBeenCalled()
  })

  it("returns STRIPE_ERROR when the session has no URL", async () => {
    mocks.getOrCreateStripeCustomer.mockResolvedValue({ ok: true, data: "cus_1" })
    mockStripeSessionsCreate.mockResolvedValue({ url: null })

    const result = await createCheckoutSession(params)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("STRIPE_ERROR")
  })

  it("returns STRIPE_ERROR when session creation throws", async () => {
    mocks.getOrCreateStripeCustomer.mockResolvedValue({ ok: true, data: "cus_1" })
    mockStripeSessionsCreate.mockRejectedValue(new Error("stripe down"))

    const result = await createCheckoutSession(params)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("STRIPE_ERROR")
  })
})
