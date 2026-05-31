import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  checkRateLimit: vi.fn(),
  changeMemberRole: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/team", () => ({ changeMemberRole: mocks.changeMemberRole }))

import { PATCH } from "@/app/api/team/role/route"

const user = { id: "owner-1", email: "owner@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "owner-1", created_at: "" }
const MEMBER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

function request(body: unknown): Request {
  return new Request("http://localhost/api/team/role", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.changeMemberRole.mockResolvedValue({ ok: true, data: { workspaceId: "ws-1" } })
})

describe("PATCH /api/team/role", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    expect((await PATCH(request({ memberUserId: MEMBER_ID, role: "admin" }))).status).toBe(401)
  })

  it("returns 400 on an invalid role", async () => {
    const response = await PATCH(request({ memberUserId: MEMBER_ID, role: "owner" }))
    expect(response.status).toBe(400)
    expect(mocks.changeMemberRole).not.toHaveBeenCalled()
  })

  it("maps a FORBIDDEN result to 403", async () => {
    mocks.changeMemberRole.mockResolvedValue({ ok: false, error: { error: "owner", code: "FORBIDDEN" } })
    expect((await PATCH(request({ memberUserId: MEMBER_ID, role: "member" }))).status).toBe(403)
  })

  it("returns 200 on success", async () => {
    const response = await PATCH(request({ memberUserId: MEMBER_ID, role: "admin" }))
    expect(response.status).toBe(200)
    expect(mocks.changeMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", memberUserId: MEMBER_ID, newRole: "admin", actorId: "owner-1" }),
    )
  })
})
