import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  listActivity: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/admin-activity", () => ({ listActivity: mocks.listActivity }))

import { GET } from "@/app/api/admin/activity/route"

const admin = { id: "admin-1", role: "admin" }

function request(url = "http://localhost/api/admin/activity"): Request {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, data: admin })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.listActivity.mockResolvedValue({ ok: true, data: { activities: [], page: 1, pageSize: 20 } })
})

describe("GET /api/admin/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(mocks.listActivity).not.toHaveBeenCalled()
  })

  it("returns 403 when authenticated but not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await GET(request())
    expect(response.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await GET(request())
    expect(response.status).toBe(429)
    expect(mocks.listActivity).not.toHaveBeenCalled()
  })

  it("passes the action filter + page through to listActivity", async () => {
    const response = await GET(request("http://localhost/api/admin/activity?action=admin.plan_override&page=2"))
    expect(response.status).toBe(200)
    expect(mocks.listActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.plan_override", page: 2 }),
    )
  })

  it("returns 400 when workspaceId is not a uuid", async () => {
    const response = await GET(request("http://localhost/api/admin/activity?workspaceId=not-a-uuid"))
    expect(response.status).toBe(400)
    expect(mocks.listActivity).not.toHaveBeenCalled()
  })

  it("returns 500 when the read fails", async () => {
    mocks.listActivity.mockResolvedValue({ ok: false, error: { error: "boom", code: "INTERNAL_ERROR" } })
    const response = await GET(request())
    expect(response.status).toBe(500)
  })
})
