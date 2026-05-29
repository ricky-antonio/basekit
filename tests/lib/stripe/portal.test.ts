import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockStripe,
  mockStripePortalSessionsCreate,
  resetStripeMock,
} from "@/tests/mocks/stripe"

vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { createPortalSession } from "@/lib/stripe/portal"

beforeEach(() => {
  resetStripeMock()
  vi.clearAllMocks()
})

describe("createPortalSession", () => {
  it("returns the portal URL on success", async () => {
    mockStripePortalSessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/1" })
    const result = await createPortalSession({ customerId: "cus_1", returnUrl: "https://app/settings/billing" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe("https://billing.stripe.com/p/1")
    expect(mockStripePortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://app/settings/billing",
    })
  })

  it("returns STRIPE_ERROR when portal creation throws", async () => {
    mockStripePortalSessionsCreate.mockRejectedValue(new Error("stripe down"))
    const result = await createPortalSession({ customerId: "cus_1", returnUrl: "https://app" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("STRIPE_ERROR")
  })
})
