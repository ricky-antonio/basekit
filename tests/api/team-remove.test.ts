import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  checkRateLimit: vi.fn(),
  removeMember: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/team", () => ({ removeMember: mocks.removeMember }))

import { DELETE } from "@/app/api/team/remove/route"

const user = { id: "owner-1", email: "owner@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "owner-1", created_at: "" }
const MEMBER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

function request(body: unknown): Request {
  return new Request("http://localhost/api/team/remove", {
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
  mocks.removeMember.mockResolvedValue({ ok: true, data: { workspaceId: "ws-1" } })
})

describe("DELETE /api/team/remove", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    expect((await DELETE(request({ memberUserId: MEMBER_ID }))).status).toBe(401)
  })

  it("returns 400 on an invalid member id", async () => {
    const response = await DELETE(request({ memberUserId: "not-a-uuid" }))
    expect(response.status).toBe(400)
    expect(mocks.removeMember).not.toHaveBeenCalled()
  })

  it("maps a FORBIDDEN result to 403", async () => {
    mocks.removeMember.mockResolvedValue({ ok: false, error: { error: "owner", code: "FORBIDDEN" } })
    expect((await DELETE(request({ memberUserId: MEMBER_ID }))).status).toBe(403)
  })

  it("returns 200 on success", async () => {
    const response = await DELETE(request({ memberUserId: MEMBER_ID }))
    expect(response.status).toBe(200)
    expect(mocks.removeMember).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", memberUserId: MEMBER_ID, actorId: "owner-1" }),
    )
  })
})
