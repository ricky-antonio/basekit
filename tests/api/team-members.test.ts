import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  listTeamMembers: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/team", () => ({ listTeamMembers: mocks.listTeamMembers }))

import { GET } from "@/app/api/team/members/route"

const user = { id: "owner-1", email: "owner@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "owner-1", created_at: "" }
const members = [
  { id: "m1", userId: "owner-1", role: "owner", joinedAt: "2026-01-01T00:00:00Z", displayName: "Ada", email: "owner@example.com", avatarUrl: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.listTeamMembers.mockResolvedValue({ ok: true, data: members })
})

describe("GET /api/team/members", () => {
  it("returns 401 when unauthenticated", async () => {
    mocks.requireAuth.mockResolvedValue({ ok: false, error: { error: "no", code: "UNAUTHENTICATED" } })
    expect((await GET()).status).toBe(401)
    expect(mocks.listTeamMembers).not.toHaveBeenCalled()
  })

  it("returns 404 when the workspace cannot be resolved", async () => {
    mocks.getWorkspace.mockResolvedValue({ ok: false, error: { error: "no", code: "NOT_FOUND" } })
    expect((await GET()).status).toBe(404)
  })

  it("returns 500 when enrichment fails", async () => {
    mocks.listTeamMembers.mockResolvedValue({ ok: false, error: { error: "boom", code: "INTERNAL_ERROR" } })
    expect((await GET()).status).toBe(500)
  })

  it("returns members and the current user id on success", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ members, currentUserId: "owner-1" })
    expect(mocks.listTeamMembers).toHaveBeenCalledWith("ws-1")
  })
})
