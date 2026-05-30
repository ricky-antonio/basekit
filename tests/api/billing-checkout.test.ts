import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  getActivePlan: vi.fn(),
  createCheckoutSession: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/billing", () => ({ getActivePlan: mocks.getActivePlan }))
vi.mock("@/lib/stripe/checkout", () => ({ createCheckoutSession: mocks.createCheckoutSession }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { POST } from "@/app/api/billing/checkout/route"

const mockUser = { id: "user-123", email: "user@example.com" }
const mockWorkspace = { id: "ws-123", name: "My Workspace", slug: "my-workspace", owner_id: "user-123" }
const validPriceId = process.env["STRIPE_PRICE_PRO_MONTHLY"]!

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? { priceId: validPriceId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.requireAuth.mockResolvedValue({ ok: true, data: mockUser })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: mockWorkspace })
  mocks.getActivePlan.mockResolvedValue("free")
  mocks.createCheckoutSession.mockResolvedValue({ ok: true, data: "https://checkout.stripe.com/pay/test" })
})

describe("POST /api/billing/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({
      ok: false,
      error: { error: "Unauthenticated.", code: "UNAUTHENTICATED" },
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: { error: "Too many requests.", code: "RATE_LIMITED" },
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(429)
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("returns 400 when priceId is missing", async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("returns 400 when priceId is not one of the configured prices", async () => {
    const response = await POST(makeRequest({ priceId: "price_unknown_123" }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("returns 409 when workspace already has an active subscription", async () => {
    mocks.getActivePlan.mockResolvedValue("pro")

    const response = await POST(makeRequest())
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("returns checkout URL on success", async () => {
    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.url).toBe("https://checkout.stripe.com/pay/test")
  })

  it("passes workspaceId and userEmail to createCheckoutSession", async () => {
    await POST(makeRequest({ priceId: validPriceId }))

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      workspaceId: mockWorkspace.id,
      priceId: validPriceId,
      userEmail: mockUser.email,
    })
  })
})
