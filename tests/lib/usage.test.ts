import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

const mocks = vi.hoisted(() => ({ getActivePlan: vi.fn() }))
vi.mock("@/lib/billing", () => ({ getActivePlan: mocks.getActivePlan }))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import {
  getUsage,
  canCreateProject,
  canAddMember,
  incrementUsage,
  decrementUsage,
} from "@/lib/usage"
import * as Sentry from "@sentry/nextjs"

const workspaceId = "ws-123"

beforeEach(() => {
  resetSupabaseMock()
  mocks.getActivePlan.mockReset()
  vi.clearAllMocks()
})

describe("getUsage", () => {
  it("returns the stored count", async () => {
    mockSupabaseFrom("usage", { data: { count: 2 }, error: null })
    const result = await getUsage(workspaceId, "projects")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(2)
  })

  it("returns 0 when no counter row exists", async () => {
    mockSupabaseFrom("usage", { data: null, error: null })
    const result = await getUsage(workspaceId, "projects")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toBe(0)
  })

  it("returns INTERNAL_ERROR when the read fails", async () => {
    mockSupabaseFrom("usage", { data: null, error: { message: "db down" } })
    const result = await getUsage(workspaceId, "projects")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("canCreateProject", () => {
  it("returns true when under the free limit", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    mockSupabaseFrom("usage", { data: { count: 2 }, error: null })
    expect(await canCreateProject(workspaceId)).toBe(true)
  })

  it("returns false at the free limit", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    mockSupabaseFrom("usage", { data: { count: 3 }, error: null })
    expect(await canCreateProject(workspaceId)).toBe(false)
  })

  it("returns true for the pro plan regardless of count", async () => {
    mocks.getActivePlan.mockResolvedValue("pro")
    mockSupabaseFrom("usage", { data: { count: 999 }, error: null })
    expect(await canCreateProject(workspaceId)).toBe(true)
  })

  it("returns true for the enterprise plan regardless of count", async () => {
    mocks.getActivePlan.mockResolvedValue("enterprise")
    mockSupabaseFrom("usage", { data: { count: 999 }, error: null })
    expect(await canCreateProject(workspaceId)).toBe(true)
  })

  it("fails open (returns true) and reports to Sentry when the DB query throws", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    vi.mocked(mockSupabase.from).mockImplementationOnce(() => {
      throw new Error("db down")
    })
    expect(await canCreateProject(workspaceId)).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe("canAddMember", () => {
  it("returns true when under the free member limit", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    mockSupabaseFrom("usage", { data: { count: 0 }, error: null })
    expect(await canAddMember(workspaceId)).toBe(true)
  })

  it("returns false at the free member limit", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    mockSupabaseFrom("usage", { data: { count: 1 }, error: null })
    expect(await canAddMember(workspaceId)).toBe(false)
  })

  it("returns true for the enterprise plan (unlimited members)", async () => {
    mocks.getActivePlan.mockResolvedValue("enterprise")
    mockSupabaseFrom("usage", { data: { count: 50 }, error: null })
    expect(await canAddMember(workspaceId)).toBe(true)
  })

  it("fails open (returns true) and reports to Sentry when the DB query throws", async () => {
    mocks.getActivePlan.mockResolvedValue("free")
    vi.mocked(mockSupabase.from).mockImplementationOnce(() => {
      throw new Error("db down")
    })
    expect(await canAddMember(workspaceId)).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe("incrementUsage", () => {
  it("calls the increment_usage RPC with the correct arguments", async () => {
    await incrementUsage(workspaceId, "projects")
    expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_usage", {
      p_workspace_id: workspaceId,
      p_resource: "projects",
    })
  })
})

describe("decrementUsage", () => {
  it("calls the decrement_usage RPC with the correct arguments", async () => {
    await decrementUsage(workspaceId, "projects")
    expect(mockSupabase.rpc).toHaveBeenCalledWith("decrement_usage", {
      p_workspace_id: workspaceId,
      p_resource: "projects",
    })
  })
})
