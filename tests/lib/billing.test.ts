import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseFrom,
  resetSupabaseMock,
  getLastWrite,
} from "@/tests/mocks/supabase"
import { mockStripe, mockStripeCustomersCreate, resetStripeMock } from "@/tests/mocks/stripe"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import {
  getWorkspaceSubscription,
  getPlanNameFromPriceId,
  getActivePlan,
  getOrCreateStripeCustomer,
} from "@/lib/billing"

const workspaceId = "ws-123"

const subscriptionRow = {
  id: "sub-1",
  workspace_id: workspaceId,
  plan_name: "pro",
  status: "active",
  cancel_at_period_end: false,
  current_period_start: "2026-01-01T00:00:00Z",
  current_period_end: "2026-02-01T00:00:00Z",
  trial_end: null,
  stripe_customer_id: "cus_existing",
  stripe_subscription_id: "stripe_sub_1",
  stripe_price_id: "price_pro_monthly_test",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

beforeEach(() => {
  resetSupabaseMock()
  resetStripeMock()
  vi.clearAllMocks()
})

describe("getPlanNameFromPriceId", () => {
  it("returns 'pro' for the pro monthly env price", () => {
    expect(getPlanNameFromPriceId("price_pro_monthly_test")).toBe("pro")
  })

  it("returns 'pro' for the pro annual env price", () => {
    expect(getPlanNameFromPriceId("price_pro_annual_test")).toBe("pro")
  })

  it("returns 'enterprise' for the enterprise monthly env price", () => {
    expect(getPlanNameFromPriceId("price_enterprise_monthly_test")).toBe("enterprise")
  })

  it("returns 'enterprise' for the enterprise annual env price", () => {
    expect(getPlanNameFromPriceId("price_enterprise_annual_test")).toBe("enterprise")
  })

  it("returns 'free' for an unknown price ID", () => {
    expect(getPlanNameFromPriceId("price_unknown")).toBe("free")
  })
})

describe("getWorkspaceSubscription", () => {
  it("returns the subscription row", async () => {
    mockSupabaseFrom("subscriptions", { data: subscriptionRow, error: null })
    const result = await getWorkspaceSubscription(workspaceId)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.plan_name).toBe("pro")
  })
})

describe("getActivePlan", () => {
  it("returns the stored plan when a subscription exists", async () => {
    mockSupabaseFrom("subscriptions", { data: subscriptionRow, error: null })
    expect(await getActivePlan(workspaceId)).toBe("pro")
  })

  it("returns 'free' when no subscription row exists", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: { message: "not found" } })
    expect(await getActivePlan(workspaceId)).toBe("free")
  })

  it("coerces an unexpected stored plan back to 'free'", async () => {
    mockSupabaseFrom("subscriptions", { data: { ...subscriptionRow, plan_name: "garbage" }, error: null })
    expect(await getActivePlan(workspaceId)).toBe("free")
  })
})

describe("getOrCreateStripeCustomer", () => {
  it("returns the existing customer ID when already set", async () => {
    mockSupabaseFrom("subscriptions", { data: { stripe_customer_id: "cus_existing" }, error: null })
    const result = await getOrCreateStripeCustomer({ workspaceId, email: "a@b.co" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe("cus_existing")
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled()
  })

  it("creates a Stripe customer and persists the ID when missing", async () => {
    mockSupabaseFrom("subscriptions", { data: { stripe_customer_id: null }, error: null })
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" })

    const result = await getOrCreateStripeCustomer({ workspaceId, email: "a@b.co" })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe("cus_new")
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: "a@b.co",
      metadata: { workspaceId },
    })
    const write = getLastWrite("subscriptions", "update")
    expect(write?.payload).toEqual({ stripe_customer_id: "cus_new" })
  })

  it("returns STRIPE_ERROR when Stripe customer creation throws", async () => {
    mockSupabaseFrom("subscriptions", { data: { stripe_customer_id: null }, error: null })
    mockStripeCustomersCreate.mockRejectedValue(new Error("stripe down"))

    const result = await getOrCreateStripeCustomer({ workspaceId, email: "a@b.co" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("STRIPE_ERROR")
  })

  it("returns INTERNAL_ERROR when the subscriptions read fails", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: { message: "db down" } })
    const result = await getOrCreateStripeCustomer({ workspaceId, email: "a@b.co" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
