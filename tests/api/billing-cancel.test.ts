import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockStripe } from "@/tests/mocks/stripe"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaceSubscription: vi.fn(),
  checkRateLimit: vi.fn(),
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/billing", () => ({ getWorkspaceSubscription: mocks.getWorkspaceSubscription }))
vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }))

import { POST } from "@/app/api/billing/cancel/route"

const mockUser = { id: "user-owner", email: "owner@example.com" }
const mockWorkspace = { id: "ws-123", name: "My Workspace", slug: "my-workspace", owner_id: "user-owner" }
const mockSubscription = {
  id: "sub-row-1",
  workspace_id: "ws-123",
  plan_name: "pro",
  status: "active",
  stripe_customer_id: "cus_test_123",
  stripe_subscription_id: "sub_test_123",
  stripe_price_id: "price_pro_monthly_test",
  cancel_at_period_end: false,
  current_period_start: "1700000000",
  current_period_end: "1702592000",
  trial_end: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.requireAuth.mockResolvedValue({ ok: true, data: mockUser })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: mockWorkspace })
  mocks.getWorkspaceSubscription.mockResolvedValue({ ok: true, data: mockSubscription })
  mockStripe.subscriptions.update.mockResolvedValue({ id: "sub_test_123", cancel_at_period_end: true })
  mocks.logActivity.mockResolvedValue(undefined)
})

describe("POST /api/billing/cancel", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: false,
      error: { error: "Unauthenticated.", code: "UNAUTHENTICATED" },
    })

    const response = await POST()
    expect(response.status).toBe(401)
  })

  it("returns 403 when user is not the workspace owner", async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: true,
      data: { id: "user-member", email: "member@example.com" },
    })

    const response = await POST()
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe("FORBIDDEN")
    expect(mockStripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it("calls stripe.subscriptions.update with cancel_at_period_end true", async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith("sub_test_123", {
      cancel_at_period_end: true,
    })
  })

  it("logs activity 'subscription.canceled'", async () => {
    await POST()

    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: mockWorkspace.id,
        actorId: mockUser.id,
        action: "subscription.canceled",
      }),
    )
  })
})
