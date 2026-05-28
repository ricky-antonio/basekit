import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseAuth, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mockSupabase }))

// Import after the mock is registered
const { getUser, requireAuth, requireAdmin } = await import("@/lib/auth")

const fakeUser = {
  id: "user-abc-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
}

beforeEach(() => {
  resetSupabaseMock()
  mockSupabaseAuth(null)
  vi.resetAllMocks()
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
})
