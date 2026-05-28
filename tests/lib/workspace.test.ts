import { describe, it, expect, vi, beforeEach } from "vitest"
import type { User } from "@supabase/supabase-js"
import {
  mockSupabase,
  mockSupabaseFrom,
  mockSupabaseRpc,
  resetSupabaseMock,
} from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

const { getWorkspace, bootstrapWorkspace } = await import("@/lib/workspace")
const { logActivity } = await import("@/lib/activity")

const fakeUser: User = {
  id: "user-abc-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
}

const fakeWorkspace = {
  id: "ws-001",
  name: "test",
  slug: "test-xyz",
  owner_id: fakeUser.id,
  created_at: new Date().toISOString(),
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("getWorkspace", () => {
  it("returns the user's workspace resolved via workspace_members", async () => {
    mockSupabaseFrom("workspace_members", {
      data: { workspace_id: fakeWorkspace.id },
      error: null,
    })
    mockSupabaseFrom("workspaces", { data: fakeWorkspace, error: null })
    const result = await getWorkspace(fakeUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe(fakeWorkspace.id)
      expect(result.data.slug).toBe(fakeWorkspace.slug)
    }
    expect(mockSupabase.from).toHaveBeenCalledWith("workspace_members")
    expect(mockSupabase.from).toHaveBeenCalledWith("workspaces")
  })

  it("resolves a workspace where the user is an invited member, not the owner", async () => {
    const otherOwnerWorkspace = { ...fakeWorkspace, owner_id: "other-owner-id" }
    mockSupabaseFrom("workspace_members", {
      data: { workspace_id: otherOwnerWorkspace.id },
      error: null,
    })
    mockSupabaseFrom("workspaces", { data: otherOwnerWorkspace, error: null })
    const result = await getWorkspace(fakeUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.owner_id).toBe("other-owner-id")
    }
  })

  it("returns ok=false when user has no membership yet", async () => {
    mockSupabaseFrom("workspace_members", {
      data: null,
      error: null,
    })
    const result = await getWorkspace(fakeUser)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND")
    }
  })

  it("returns ok=false when workspace row is missing despite membership", async () => {
    mockSupabaseFrom("workspace_members", {
      data: { workspace_id: fakeWorkspace.id },
      error: null,
    })
    mockSupabaseFrom("workspaces", {
      data: null,
      error: { message: "No rows found" },
    })
    const result = await getWorkspace(fakeUser)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND")
    }
  })
})

describe("bootstrapWorkspace", () => {
  it("calls the RPC with derived slug", async () => {
    const newId = "ws-new-001"
    mockSupabaseRpc("bootstrap_workspace", { data: newId, error: null })
    const result = await bootstrapWorkspace(fakeUser.id, fakeUser.email!)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe(newId)
    }
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "bootstrap_workspace",
      expect.objectContaining({ p_user_id: fakeUser.id }),
    )
  })

  it("returns ok=false on RPC error", async () => {
    mockSupabaseRpc("bootstrap_workspace", {
      data: null,
      error: { message: "DB error" },
    })
    const result = await bootstrapWorkspace(fakeUser.id, fakeUser.email!)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR")
    }
  })

  it("logs an activity event on success", async () => {
    const newId = "ws-new-002"
    mockSupabaseRpc("bootstrap_workspace", { data: newId, error: null })
    await bootstrapWorkspace(fakeUser.id, fakeUser.email!)
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace.created",
        workspaceId: newId,
        actorId: fakeUser.id,
      }),
    )
  })

  it("falls back to 'My Workspace' when email is empty", async () => {
    const newId = "ws-new-003"
    mockSupabaseRpc("bootstrap_workspace", { data: newId, error: null })
    await bootstrapWorkspace(fakeUser.id, "")
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "bootstrap_workspace",
      expect.objectContaining({
        p_user_id: fakeUser.id,
        p_name: "My Workspace",
        p_slug: expect.stringMatching(/^workspace-/),
      }),
    )
  })
})
