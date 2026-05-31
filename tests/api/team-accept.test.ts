import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  acceptInvitation: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/invitations", () => ({ acceptInvitation: mocks.acceptInvitation }))

import { POST } from "@/app/api/team/accept/route"

const user = { id: "user-9", email: "invitee@example.com" }

function request(body: unknown): Request {
  return new Request("http://localhost/api/team/accept", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.acceptInvitation.mockResolvedValue({ ok: true, data: { workspaceId: "ws-1", role: "member" } })
})

describe("POST /api/team/accept", () => {
  it("returns 400 on a missing token", async () => {
    const response = await POST(request({}))
    expect(response.status).toBe(400)
    expect(mocks.acceptInvitation).not.toHaveBeenCalled()
  })

  it("returns 404 on an unknown token", async () => {
    mocks.acceptInvitation.mockResolvedValue({ ok: false, error: { error: "gone", code: "NOT_FOUND" } })
    const response = await POST(request({ token: "tok" }))
    expect(response.status).toBe(404)
  })

  it("returns 400 (ok=false) on an expired token", async () => {
    mocks.acceptInvitation.mockResolvedValue({ ok: false, error: { error: "expired", code: "VALIDATION_ERROR" } })
    const response = await POST(request({ token: "tok" }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("returns 200 on success and reports the joined workspace", async () => {
    const response = await POST(request({ token: "tok" }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.workspaceId).toBe("ws-1")
    expect(mocks.acceptInvitation).toHaveBeenCalledWith({ token: "tok", userId: "user-9" })
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await POST(request({ token: "tok" }))
    expect(response.status).toBe(429)
    expect(mocks.acceptInvitation).not.toHaveBeenCalled()
  })
})
