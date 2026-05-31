import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  checkRateLimit: vi.fn(),
  inviteMember: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/invitations", () => ({ inviteMember: mocks.inviteMember }))

import { POST } from "@/app/api/team/invite/route"

const user = { id: "owner-1", email: "owner@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "owner-1", created_at: "" }

function request(body: unknown): Request {
  return new Request("http://localhost/api/team/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.inviteMember.mockResolvedValue({
    ok: true,
    data: { id: "inv-1", email: "new@example.com", role: "member", expiresAt: "", createdAt: "" },
  })
})

describe("POST /api/team/invite", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    const response = await POST(request({ email: "new@example.com" }))
    expect(response.status).toBe(401)
    expect(mocks.inviteMember).not.toHaveBeenCalled()
  })

  it("returns 403 when caller is a plain member", async () => {
    mocks.inviteMember.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await POST(request({ email: "new@example.com" }))
    expect(response.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await POST(request({ email: "new@example.com" }))
    expect(response.status).toBe(429)
    expect(mocks.inviteMember).not.toHaveBeenCalled()
  })

  it("returns 400 on an invalid email", async () => {
    const response = await POST(request({ email: "not-an-email" }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(mocks.inviteMember).not.toHaveBeenCalled()
  })

  it("returns 403 with LIMIT_EXCEEDED at the member cap", async () => {
    mocks.inviteMember.mockResolvedValue({
      ok: false,
      error: { error: "limit", code: "LIMIT_EXCEEDED", upgradeUrl: "/settings/billing" },
    })
    const response = await POST(request({ email: "new@example.com" }))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe("LIMIT_EXCEEDED")
    expect(body.upgradeUrl).toBe("/settings/billing")
  })

  it("returns 200 with the invitation id on success", async () => {
    const response = await POST(request({ email: "new@example.com", role: "admin" }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.invitation.id).toBe("inv-1")
    expect(mocks.inviteMember).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", email: "new@example.com", role: "admin", invitedBy: "owner-1" }),
    )
  })
})
