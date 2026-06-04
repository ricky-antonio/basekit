import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  getUserDetail: vi.fn(),
  overrideUserPlan: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/admin", () => ({ getUserDetail: mocks.getUserDetail, overrideUserPlan: mocks.overrideUserPlan }))

import { GET, PATCH } from "@/app/api/admin/users/[id]/route"

const admin = { id: "admin-1", role: "admin" }

function ctx() {
  return { params: Promise.resolve({ id: "u1" }) }
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/users/u1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, data: admin })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.getUserDetail.mockResolvedValue({ ok: true, data: { userId: "u1", email: "a@test.com" } })
  mocks.overrideUserPlan.mockResolvedValue({ ok: true, data: { userId: "u1", plan: "pro" } })
})

describe("GET /api/admin/users/[id]", () => {
  it("returns full user detail", async () => {
    const response = await GET(new Request("http://localhost/api/admin/users/u1"), ctx())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.userId).toBe("u1")
  })

  it("returns 404 when the user is missing", async () => {
    mocks.getUserDetail.mockResolvedValue({ ok: false, error: { error: "no", code: "NOT_FOUND" } })
    const response = await GET(new Request("http://localhost/api/admin/users/u1"), ctx())
    expect(response.status).toBe(404)
  })

  it("returns 403 when not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await GET(new Request("http://localhost/api/admin/users/u1"), ctx())
    expect(response.status).toBe(403)
    expect(mocks.getUserDetail).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/admin/users/[id]", () => {
  it("overrides plan when admin", async () => {
    const response = await PATCH(patchRequest({ plan: "pro", reason: "comped" }), ctx())
    expect(response.status).toBe(200)
    expect(mocks.overrideUserPlan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", plan: "pro", reason: "comped", admin }),
    )
  })

  it("returns 403 when not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await PATCH(patchRequest({ plan: "pro", reason: "x" }), ctx())
    expect(response.status).toBe(403)
    expect(mocks.overrideUserPlan).not.toHaveBeenCalled()
  })

  it("returns 400 when plan is invalid", async () => {
    const response = await PATCH(patchRequest({ plan: "platinum", reason: "x" }), ctx())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(mocks.overrideUserPlan).not.toHaveBeenCalled()
  })

  it("returns 400 when reason is missing", async () => {
    const response = await PATCH(patchRequest({ plan: "pro" }), ctx())
    expect(response.status).toBe(400)
    expect(mocks.overrideUserPlan).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await PATCH(patchRequest({ plan: "pro", reason: "x" }), ctx())
    expect(response.status).toBe(429)
    expect(mocks.overrideUserPlan).not.toHaveBeenCalled()
  })
})
