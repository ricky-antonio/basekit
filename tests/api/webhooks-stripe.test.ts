import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseFrom,
  resetSupabaseMock,
  getLastWrite,
} from "@/tests/mocks/supabase"
import { mockStripe, mockStripeWebhookConstructEvent, resetStripeMock } from "@/tests/mocks/stripe"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))

const mocks = vi.hoisted(() => ({
  handleStripeEvent: vi.fn(),
  checkRateLimit: vi.fn(),
}))
vi.mock("@/lib/stripe/webhooks", () => ({ handleStripeEvent: mocks.handleStripeEvent }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { POST } from "@/app/api/webhooks/stripe/route"
import * as Sentry from "@sentry/nextjs"

const sampleEvent = { id: "evt_1", type: "checkout.session.completed" }

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "test_sig", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(sampleEvent),
  })
}

beforeEach(() => {
  resetSupabaseMock()
  resetStripeMock()
  mocks.handleStripeEvent.mockReset()
  mocks.checkRateLimit.mockReset()
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.handleStripeEvent.mockResolvedValue(undefined)
  vi.clearAllMocks()
})

describe("POST /api/webhooks/stripe", () => {
  it("returns 400 on an invalid signature", async () => {
    mockStripeWebhookConstructEvent.mockImplementation(() => {
      throw new Error("bad signature")
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
  })

  it("returns 200 on a valid event", async () => {
    mockStripeWebhookConstructEvent.mockReturnValue(sampleEvent)
    mockSupabaseFrom("stripe_events", { data: null, error: null })

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(mocks.handleStripeEvent).toHaveBeenCalledWith(sampleEvent)
  })

  it("returns 200 on a duplicate event without re-processing", async () => {
    mockStripeWebhookConstructEvent.mockReturnValue(sampleEvent)
    mockSupabaseFrom("stripe_events", { data: { id: "evt_1" }, error: null })

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.duplicate).toBe(true)
    expect(mocks.handleStripeEvent).not.toHaveBeenCalled()
  })

  it("inserts a row in stripe_events after successful processing", async () => {
    mockStripeWebhookConstructEvent.mockReturnValue(sampleEvent)
    mockSupabaseFrom("stripe_events", { data: null, error: null })

    await POST(makeRequest())

    const write = getLastWrite("stripe_events", "insert")
    expect(write?.payload).toEqual({ id: "evt_1", type: "checkout.session.completed" })
  })

  it("returns 200 even when the handler throws, and does not record the event", async () => {
    mockStripeWebhookConstructEvent.mockReturnValue(sampleEvent)
    mockSupabaseFrom("stripe_events", { data: null, error: null })
    mocks.handleStripeEvent.mockRejectedValue(new Error("boom"))

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(Sentry.captureException).toHaveBeenCalled()
    expect(getLastWrite("stripe_events", "insert")).toBeUndefined()
  })

  it("returns 429 when the rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: { error: "Too many requests.", code: "RATE_LIMITED" },
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(429)
    expect(mockStripeWebhookConstructEvent).not.toHaveBeenCalled()
  })
})
