import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  listUsers: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/admin", () => ({ listUsers: mocks.listUsers }))

import { GET } from "@/app/api/admin/users/route"

const admin = { id: "admin-1", role: "admin" }

function request(qs = ""): Request {
  return new Request(`http://localhost/api/admin/users${qs}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, data: admin })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.listUsers.mockResolvedValue({ ok: true, data: { users: [], total: 0, page: 1, pageSize: 20 } })
})

describe("GET /api/admin/users", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(mocks.listUsers).not.toHaveBeenCalled()
  })

  it("returns 403 when authenticated but not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(mocks.listUsers).not.toHaveBeenCalled()
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await GET(request())
    expect(response.status).toBe(429)
    expect(mocks.listUsers).not.toHaveBeenCalled()
  })

  it("returns 200 with paginated users when admin", async () => {
    mocks.listUsers.mockResolvedValue({
      ok: true,
      data: { users: [{ userId: "u1", email: "a@test.com" }], total: 1, page: 1, pageSize: 20 },
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(1)
    expect(body.users).toHaveLength(1)
  })

  it("respects ?search query param", async () => {
    await GET(request("?search=alice"))
    expect(mocks.listUsers).toHaveBeenCalledWith(expect.objectContaining({ search: "alice" }))
  })

  it("respects ?plan filter", async () => {
    await GET(request("?plan=pro"))
    expect(mocks.listUsers).toHaveBeenCalledWith(expect.objectContaining({ plan: "pro" }))
  })

  it("returns 400 on an invalid plan filter", async () => {
    const response = await GET(request("?plan=platinum"))
    expect(response.status).toBe(400)
    expect(mocks.listUsers).not.toHaveBeenCalled()
  })
})
