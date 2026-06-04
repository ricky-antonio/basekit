import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  getMetrics: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/admin-metrics", () => ({ getMetrics: mocks.getMetrics }))

import { GET } from "@/app/api/admin/metrics/route"

const admin = { id: "admin-1", role: "admin" }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, data: admin })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.getMetrics.mockResolvedValue({ ok: true, data: { mrr: 100, arr: 1200 } })
})

describe("GET /api/admin/metrics", () => {
  it("returns 403 when not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await GET()
    expect(response.status).toBe(403)
    expect(mocks.getMetrics).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await GET()
    expect(response.status).toBe(429)
    expect(mocks.getMetrics).not.toHaveBeenCalled()
  })

  it("returns 200 with metrics when admin", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.mrr).toBe(100)
  })

  it("returns 500 when metrics computation fails", async () => {
    mocks.getMetrics.mockResolvedValue({ ok: false, error: { error: "boom", code: "INTERNAL_ERROR" } })
    const response = await GET()
    expect(response.status).toBe(500)
  })
})
