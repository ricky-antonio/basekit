import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseAuth,
  mockSupabaseFrom,
  mockSupabaseAdminUser,
  resetSupabaseMock,
} from "@/tests/mocks/supabase"

const mocks = vi.hoisted(() => ({ getImpersonationContext: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))
vi.mock("@/lib/impersonation", () => ({ getImpersonationContext: mocks.getImpersonationContext }))

// Import after the mocks are registered
const { getUser, getSessionUser, requireAuth, requireAdmin } = await import("@/lib/auth")

const fakeUser = {
  id: "user-abc-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
}

const adminUser = { ...fakeUser, id: "admin-1", email: "admin@example.com" }

beforeEach(() => {
  resetSupabaseMock()
  mockSupabaseAuth(null)
  vi.clearAllMocks()
  mocks.getImpersonationContext.mockResolvedValue(null)
})

describe("getSessionUser", () => {
  it("returns the real session user", async () => {
    mockSupabaseAuth(fakeUser)
    const user = await getSessionUser()
    expect(user).toMatchObject({ id: fakeUser.id })
  })

  it("returns the real session user even while impersonating", async () => {
    mockSupabaseAuth(adminUser)
    mocks.getImpersonationContext.mockResolvedValue({
      adminId: adminUser.id,
      targetUserId: "target-1",
      targetEmail: "t@example.com",
      expiresAt: Date.now() + 1000,
    })
    const user = await getSessionUser()
    expect(user?.id).toBe(adminUser.id)
  })
})

describe("getUser", () => {
  it("returns user when session exists", async () => {
    mockSupabaseAuth(fakeUser)
    const user = await getUser()
    expect(user).toMatchObject({ id: fakeUser.id, email: fakeUser.email })
  })

  it("returns null when no session", async () => {
    mockSupabaseAuth(null)
    const user = await getUser()
    expect(user).toBeNull()
  })

  it("returns the impersonated target when an admin holds a valid cookie", async () => {
    mockSupabaseAuth(adminUser)
    mockSupabaseFrom("profiles", { data: { role: "admin" }, error: null })
    mockSupabaseAdminUser({ id: "target-1", email: "target@example.com" })
    mocks.getImpersonationContext.mockResolvedValue({
      adminId: adminUser.id,
      targetUserId: "target-1",
      targetEmail: "target@example.com",
      expiresAt: Date.now() + 1000,
    })
    const user = await getUser()
    expect(user?.id).toBe("target-1")
  })

  it("ignores the cookie when the session user is not the admin who minted it", async () => {
    mockSupabaseAuth(fakeUser)
    mocks.getImpersonationContext.mockResolvedValue({
      adminId: "some-other-admin",
      targetUserId: "target-1",
      targetEmail: "target@example.com",
      expiresAt: Date.now() + 1000,
    })
    const user = await getUser()
    expect(user?.id).toBe(fakeUser.id)
  })

  it("ignores the cookie when the session user is not actually an admin", async () => {
    mockSupabaseAuth(adminUser)
    mockSupabaseFrom("profiles", { data: { role: "user" }, error: null })
    mocks.getImpersonationContext.mockResolvedValue({
      adminId: adminUser.id,
      targetUserId: "target-1",
      targetEmail: "target@example.com",
      expiresAt: Date.now() + 1000,
    })
    const user = await getUser()
    expect(user?.id).toBe(adminUser.id)
  })
})

describe("requireAuth", () => {
  it("returns ok=true with user when authenticated", async () => {
    mockSupabaseAuth(fakeUser)
    const result = await requireAuth()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe(fakeUser.id)
    }
  })

  it("returns ok=false with UNAUTHENTICATED when not authenticated", async () => {
    mockSupabaseAuth(null)
    const result = await requireAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHENTICATED")
    }
  })
})

describe("requireAdmin", () => {
  it("returns ok=true when role is admin", async () => {
    mockSupabaseAuth(fakeUser)
    mockSupabaseFrom("profiles", { data: { role: "admin" }, error: null })
    const result = await requireAdmin()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.role).toBe("admin")
    }
  })

  it("returns ok=false with FORBIDDEN when role is user", async () => {
    mockSupabaseAuth(fakeUser)
    mockSupabaseFrom("profiles", { data: { role: "user" }, error: null })
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN")
    }
  })

  it("returns ok=false with UNAUTHENTICATED when no session", async () => {
    mockSupabaseAuth(null)
    const result = await requireAdmin()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHENTICATED")
    }
  })

  it("authorizes the real admin (not the target) while impersonating", async () => {
    mockSupabaseAuth(adminUser)
    mockSupabaseFrom("profiles", { data: { role: "admin" }, error: null })
    mocks.getImpersonationContext.mockResolvedValue({
      adminId: adminUser.id,
      targetUserId: "target-1",
      targetEmail: "target@example.com",
      expiresAt: Date.now() + 1000,
    })
    const result = await requireAdmin()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe(adminUser.id)
      expect(result.data.role).toBe("admin")
    }
  })
})
