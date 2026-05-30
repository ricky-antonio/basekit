import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

const mocks = vi.hoisted(() => ({
  canCreateProject: vi.fn(),
  incrementUsage: vi.fn(),
  decrementUsage: vi.fn(),
}))
vi.mock("@/lib/usage", () => ({
  canCreateProject: mocks.canCreateProject,
  incrementUsage: mocks.incrementUsage,
  decrementUsage: mocks.decrementUsage,
}))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { listProjects, getProject, createProject, deleteProject } from "@/lib/projects"

const workspaceId = "ws-123"
const userId = "user-123"

beforeEach(() => {
  resetSupabaseMock()
  mocks.canCreateProject.mockReset()
  mocks.incrementUsage.mockReset().mockResolvedValue(undefined)
  mocks.decrementUsage.mockReset().mockResolvedValue(undefined)
  vi.clearAllMocks()
})

describe("listProjects", () => {
  it("returns projects in the workspace", async () => {
    const rows = [
      { id: "p1", workspace_id: workspaceId, name: "Alpha", description: null, created_at: "2026-01-01" },
      { id: "p2", workspace_id: workspaceId, name: "Beta", description: "x", created_at: "2026-01-02" },
    ]
    mockSupabaseFrom("projects", { data: rows, error: null })
    const result = await listProjects(workspaceId)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(2)
  })

  it("returns an empty array when there are no projects", async () => {
    mockSupabaseFrom("projects", { data: [], error: null })
    const result = await listProjects(workspaceId)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual([])
  })

  it("returns INTERNAL_ERROR when the query fails", async () => {
    mockSupabaseFrom("projects", { data: null, error: { message: "db down" } })
    const result = await listProjects(workspaceId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("getProject", () => {
  it("returns the project row", async () => {
    const row = { id: "p1", workspace_id: workspaceId, name: "Alpha", description: null, created_at: "2026-01-01" }
    mockSupabaseFrom("projects", { data: row, error: null })
    const result = await getProject("p1")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.name).toBe("Alpha")
  })

  it("returns NOT_FOUND when the project does not exist", async () => {
    mockSupabaseFrom("projects", { data: null, error: null })
    const result = await getProject("missing")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })
})

describe("createProject", () => {
  it("returns LIMIT_EXCEEDED when canCreateProject is false", async () => {
    mocks.canCreateProject.mockResolvedValue(false)
    const result = await createProject({ workspaceId, name: "Nope" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("LIMIT_EXCEEDED")
      expect(result.error.upgradeUrl).toBe("/settings/billing")
    }
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
  })

  it("inserts the row and increments usage on success", async () => {
    mocks.canCreateProject.mockResolvedValue(true)
    const row = { id: "p9", workspace_id: workspaceId, name: "Gamma", description: null, created_at: "2026-01-03" }
    mockSupabaseFrom("projects", { data: row, error: null })
    const result = await createProject({ workspaceId, name: "Gamma" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.id).toBe("p9")
    expect(mocks.incrementUsage).toHaveBeenCalledWith(workspaceId, "projects")
  })

  it("returns INTERNAL_ERROR and does not increment usage when the insert fails", async () => {
    mocks.canCreateProject.mockResolvedValue(true)
    mockSupabaseFrom("projects", { data: null, error: { message: "insert failed" } })
    const result = await createProject({ workspaceId, name: "Gamma" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
  })
})

describe("deleteProject", () => {
  it("removes the row and decrements usage for an owner", async () => {
    mockSupabaseFrom("projects", { data: { id: "p1", workspace_id: workspaceId }, error: null })
    mockSupabaseFrom("workspace_members", { data: { role: "owner" }, error: null })

    const result = await deleteProject("p1", userId)
    expect(result.ok).toBe(true)
    expect(mocks.decrementUsage).toHaveBeenCalledWith(workspaceId, "projects")
  })

  it("returns FORBIDDEN when the caller is a non-admin member", async () => {
    mockSupabaseFrom("projects", { data: { id: "p1", workspace_id: workspaceId }, error: null })
    mockSupabaseFrom("workspace_members", { data: { role: "member" }, error: null })

    const result = await deleteProject("p1", userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.decrementUsage).not.toHaveBeenCalled()
  })

  it("returns NOT_FOUND when the project does not exist", async () => {
    mockSupabaseFrom("projects", { data: null, error: null })
    const result = await deleteProject("missing", userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })
})
