import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseFrom,
  mockSupabaseAdminUser,
  getLastWrite,
  getSupabaseFilters,
  resetSupabaseMock,
} from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

const mocks = vi.hoisted(() => ({ logActivity: vi.fn() }))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { listUsers, getUserDetail, overrideUserPlan, listActivity } from "@/lib/admin"
import type { AuthUser } from "@/lib/auth"

const adminUser = { id: "admin-1", role: "admin" } as unknown as AuthUser
const plainUser = { id: "user-2", role: "user" } as unknown as AuthUser

function seedTwoUsers() {
  mockSupabaseFrom("subscriptions", {
    data: [
      { workspace_id: "ws-a", plan_name: "pro", status: "active", created_at: "2026-01-02T00:00:00Z", stripe_customer_id: "cus_a" },
      { workspace_id: "ws-b", plan_name: "free", status: "active", created_at: "2026-01-01T00:00:00Z", stripe_customer_id: null },
    ],
    error: null,
  })
  mockSupabaseFrom("workspaces", {
    data: [
      { id: "ws-a", name: "Acme", slug: "acme", owner_id: "owner-a", created_at: "2026-01-02T00:00:00Z" },
      { id: "ws-b", name: "Beta", slug: "beta", owner_id: "owner-b", created_at: "2026-01-01T00:00:00Z" },
    ],
    error: null,
  })
  mockSupabaseFrom("profiles", {
    data: [
      { id: "owner-a", display_name: "Alice", avatar_url: null, role: "user" },
      { id: "owner-b", display_name: "Bob", avatar_url: null, role: "admin" },
    ],
    error: null,
  })
  // The mock resolves every getUserById to the same account, so both owners share an
  // email — enough to prove email participates in search alongside display_name.
  mockSupabaseAdminUser({ id: "owner", email: "team@acme.test", user_metadata: {} })
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("listUsers", () => {
  it("returns paginated users", async () => {
    seedTwoUsers()
    const result = await listUsers({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.users).toHaveLength(2)
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.pageSize).toBe(20)

    const alice = result.data.users.find((u) => u.userId === "owner-a")
    expect(alice?.workspaceName).toBe("Acme")
    expect(alice?.planName).toBe("pro")
    expect(alice?.email).toBe("team@acme.test")
    expect(alice?.displayName).toBe("Alice")
    expect(alice?.role).toBe("user")
  })

  it("filters by plan", async () => {
    seedTwoUsers()
    await listUsers({ plan: "pro" })
    expect(getSupabaseFilters("subscriptions")).toContainEqual(
      expect.objectContaining({ method: "eq", args: ["plan_name", "pro"] }),
    )
  })

  it("filters by status", async () => {
    seedTwoUsers()
    await listUsers({ status: "past_due" })
    expect(getSupabaseFilters("subscriptions")).toContainEqual(
      expect.objectContaining({ method: "eq", args: ["status", "past_due"] }),
    )
  })

  it("search matches email and display_name", async () => {
    seedTwoUsers()
    const byName = await listUsers({ search: "bob" })
    expect(byName.ok && byName.data.users.map((u) => u.userId)).toEqual(["owner-b"])

    seedTwoUsers()
    const byEmail = await listUsers({ search: "acme" })
    expect(byEmail.ok && byEmail.data.users).toHaveLength(2)
  })

  it("returns an empty list when there are no subscriptions", async () => {
    mockSupabaseFrom("subscriptions", { data: [], error: null })
    const result = await listUsers({})
    expect(result.ok && result.data.total).toBe(0)
  })

  it("returns INTERNAL_ERROR when the read fails", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: { message: "boom" } })
    const result = await listUsers({})
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("getUserDetail", () => {
  function seedDetail() {
    mockSupabaseFrom("profiles", { data: { id: "u1", display_name: "Alice", avatar_url: "a.png", role: "user" }, error: null })
    mockSupabaseAdminUser({ id: "u1", email: "alice@test.com", user_metadata: {} })
    mockSupabaseFrom("workspaces", { data: { id: "ws-1", name: "Acme", slug: "acme", created_at: "2026-01-01T00:00:00Z" }, error: null })
    mockSupabaseFrom("subscriptions", {
      data: { plan_name: "pro", status: "active", cancel_at_period_end: false, current_period_end: "2026-07-01T00:00:00Z", stripe_customer_id: "cus_1" },
      error: null,
    })
    mockSupabaseFrom("activity_log", {
      data: [
        { id: "act-1", workspace_id: "ws-1", actor_id: "u1", impersonator_id: null, action: "project.created", target_type: "project", target_id: "p1", metadata: { name: "X" }, created_at: "2026-01-02T00:00:00Z" },
      ],
      error: null,
    })
  }

  it("returns user + subscription + workspace + recent activity", async () => {
    seedDetail()
    const result = await getUserDetail("u1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.email).toBe("alice@test.com")
    expect(result.data.displayName).toBe("Alice")
    expect(result.data.workspace?.name).toBe("Acme")
    expect(result.data.subscription?.planName).toBe("pro")
    expect(result.data.recentActivity).toHaveLength(1)
    expect(result.data.recentActivity[0]?.action).toBe("project.created")
  })

  it("returns NOT_FOUND for missing user", async () => {
    mockSupabaseFrom("profiles", { data: null, error: null })
    const result = await getUserDetail("missing")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns INTERNAL_ERROR when the profile read fails", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "boom" } })
    const result = await getUserDetail("u1")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns null subscription + empty activity when the user owns no workspace", async () => {
    mockSupabaseFrom("profiles", { data: { id: "u1", display_name: "Alice", avatar_url: null, role: "user" }, error: null })
    mockSupabaseAdminUser({ id: "u1", email: "alice@test.com", user_metadata: {} })
    mockSupabaseFrom("workspaces", { data: null, error: null })
    const result = await getUserDetail("u1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.workspace).toBeNull()
    expect(result.data.subscription).toBeNull()
    expect(result.data.recentActivity).toEqual([])
  })
})

describe("overrideUserPlan", () => {
  function seedOverride() {
    mockSupabaseFrom("workspaces", { data: { id: "ws-1" }, error: null })
    mockSupabaseFrom("subscriptions", { data: { plan_name: "free" }, error: null })
  }

  it("updates subscriptions.plan_name", async () => {
    seedOverride()
    const result = await overrideUserPlan({ admin: adminUser, userId: "u1", plan: "pro", reason: "comped" })
    expect(result.ok).toBe(true)
    const write = getLastWrite("subscriptions", "update")
    expect(write?.payload).toMatchObject({ plan_name: "pro", status: "active", cancel_at_period_end: false })
  })

  it("logs activity admin.plan_override", async () => {
    seedOverride()
    await overrideUserPlan({ admin: adminUser, userId: "u1", plan: "enterprise", reason: "vip" })
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.plan_override",
        actorId: "admin-1",
        workspaceId: "ws-1",
        metadata: expect.objectContaining({ from: "free", to: "enterprise", reason: "vip", targetUserId: "u1" }),
      }),
    )
  })

  it("returns FORBIDDEN when caller is not admin", async () => {
    const result = await overrideUserPlan({ admin: plainUser, userId: "u1", plan: "pro", reason: "x" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })

  it("returns NOT_FOUND when the user owns no workspace", async () => {
    mockSupabaseFrom("workspaces", { data: null, error: null })
    const result = await overrideUserPlan({ admin: adminUser, userId: "u1", plan: "pro", reason: "x" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("NOT_FOUND")
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
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
