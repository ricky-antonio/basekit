import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaceSubscription: vi.fn(),
  createPortalSession: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/billing", () => ({ getWorkspaceSubscription: mocks.getWorkspaceSubscription }))
vi.mock("@/lib/stripe/portal", () => ({ createPortalSession: mocks.createPortalSession }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { POST } from "@/app/api/billing/portal/route"

const mockUser = { id: "user-123", email: "user@example.com" }
const mockWorkspace = { id: "ws-123", name: "My Workspace", slug: "my-workspace", owner_id: "user-123" }
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

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/billing/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.requireAuth.mockResolvedValue({ ok: true, data: mockUser })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: mockWorkspace })
  mocks.getWorkspaceSubscription.mockResolvedValue({ ok: true, data: mockSubscription })
  mocks.createPortalSession.mockResolvedValue({ ok: true, data: "https://billing.stripe.com/p/test" })
})

describe("POST /api/billing/portal", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: false,
      error: { error: "Unauthenticated.", code: "UNAUTHENTICATED" },
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it("returns 400 when no stripe_customer_id (free user)", async () => {
    mocks.getWorkspaceSubscription.mockResolvedValue({
      ok: true,
      data: { ...mockSubscription, stripe_customer_id: null },
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("NOT_FOUND")
    expect(mocks.createPortalSession).not.toHaveBeenCalled()
  })

  it("returns portal URL on success", async () => {
    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.url).toBe("https://billing.stripe.com/p/test")
  })
})
