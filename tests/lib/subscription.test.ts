import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

import { getSubscription } from "@/lib/subscription"

const workspaceId = "ws-123"

const subscriptionRow = {
  id: "sub-1",
  workspace_id: workspaceId,
  plan_name: "free",
  status: "active",
  cancel_at_period_end: false,
  current_period_start: "2026-01-01T00:00:00Z",
  current_period_end: "2026-02-01T00:00:00Z",
  trial_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  stripe_price_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("getSubscription", () => {
  it("returns the subscription when found", async () => {
    mockSupabaseFrom("subscriptions", { data: subscriptionRow, error: null })
    const result = await getSubscription(workspaceId)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.plan_name).toBe("free")
      expect(result.data.status).toBe("active")
    }
  })

  it("returns NOT_FOUND when no subscription exists", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: { message: "not found" } })
    const result = await getSubscription(workspaceId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns NOT_FOUND when data is null with no error", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: null })
    const result = await getSubscription(workspaceId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })
})
