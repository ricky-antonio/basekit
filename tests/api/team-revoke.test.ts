import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  checkRateLimit: vi.fn(),
  revokeInvitation: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/invitations", () => ({ revokeInvitation: mocks.revokeInvitation }))

import { DELETE } from "@/app/api/team/revoke/route"

const user = { id: "owner-1", email: "owner@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "owner-1", created_at: "" }
const INVITE_ID = "c9bf9e57-1685-4c89-bafb-ff5af830be8a"

function request(body: unknown): Request {
  return new Request("http://localhost/api/team/revoke", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.revokeInvitation.mockResolvedValue({ ok: true, data: { workspaceId: "ws-1" } })
})

describe("DELETE /api/team/revoke", () => {
  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    expect((await DELETE(request({ invitationId: INVITE_ID }))).status).toBe(429)
    expect(mocks.revokeInvitation).not.toHaveBeenCalled()
  })

  it("returns 400 on an invalid invitation id", async () => {
    const response = await DELETE(request({ invitationId: "nope" }))
    expect(response.status).toBe(400)
    expect(mocks.revokeInvitation).not.toHaveBeenCalled()
  })

  it("maps a NOT_FOUND result to 404", async () => {
    mocks.revokeInvitation.mockResolvedValue({ ok: false, error: { error: "gone", code: "NOT_FOUND" } })
    expect((await DELETE(request({ invitationId: INVITE_ID }))).status).toBe(404)
  })

  it("returns 200 on success", async () => {
    const response = await DELETE(request({ invitationId: INVITE_ID }))
    expect(response.status).toBe(200)
    expect(mocks.revokeInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", invitationId: INVITE_ID, actorId: "owner-1" }),
    )
  })
})
