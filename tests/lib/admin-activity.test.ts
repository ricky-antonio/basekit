import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, getSupabaseFilters, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { listActivity } from "@/lib/admin-activity"

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("listActivity", () => {
  it("returns activity rows", async () => {
    mockSupabaseFrom("activity_log", {
      data: [
        { id: "a1", workspace_id: "ws-1", actor_id: "u1", impersonator_id: null, action: "member.invited", target_type: "member", target_id: "m1", metadata: {}, created_at: "2026-01-02T00:00:00Z" },
        { id: "a2", workspace_id: "ws-1", actor_id: "u1", impersonator_id: "admin-1", action: "admin.plan_override", target_type: "subscription", target_id: "ws-1", metadata: { to: "pro" }, created_at: "2026-01-03T00:00:00Z" },
      ],
      error: null,
    })
    const result = await listActivity({ page: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.activities).toHaveLength(2)
    expect(result.data.activities[1]?.impersonatorId).toBe("admin-1")
    expect(result.data.activities[0]?.metadata).toEqual({})
  })

  it("filters by action and workspace", async () => {
    mockSupabaseFrom("activity_log", { data: [], error: null })
    await listActivity({ action: "admin.plan_override", workspaceId: "ws-9" })
    const filters = getSupabaseFilters("activity_log")
    expect(filters).toContainEqual(expect.objectContaining({ args: ["action", "admin.plan_override"] }))
    expect(filters).toContainEqual(expect.objectContaining({ args: ["workspace_id", "ws-9"] }))
  })

  it("returns INTERNAL_ERROR when the read fails", async () => {
    mockSupabaseFrom("activity_log", { data: null, error: { message: "boom" } })
    const result = await listActivity({})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
