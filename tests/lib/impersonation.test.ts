// @vitest-environment node
// jose's Web Crypto signing checks `instanceof Uint8Array` against the module realm;
// jsdom's separate realm breaks that, so this server-only lib is tested under node.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mockSupabase, mockSupabaseAdminUser, resetSupabaseMock } from "@/tests/mocks/supabase"
import type { AuthUser } from "@/lib/auth"

// In-memory cookie jar standing in for next/headers cookies()
const jar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value)
    },
    delete: (name: string) => {
      jar.delete(name)
    },
  }),
}))

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => mockSupabase }))

const { startImpersonation, endImpersonation, getImpersonationContext, IMPERSONATION_COOKIE } =
  await import("@/lib/impersonation")

const admin = { id: "admin-1", role: "admin" } as unknown as AuthUser
const nonAdmin = { id: "user-9", role: "user" } as unknown as AuthUser

beforeEach(() => {
  jar.clear()
  resetSupabaseMock()
  mockSupabaseAdminUser({ id: "target-1", email: "target@example.com" })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("startImpersonation", () => {
  it("sets a cookie with a signed payload", async () => {
    const result = await startImpersonation({ admin, targetUserId: "target-1" })
    expect(result.ok).toBe(true)
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(true)
    // A signed JWT is three base64url segments
    expect(jar.get(IMPERSONATION_COOKIE)!.split(".")).toHaveLength(3)
    if (result.ok) {
      expect(result.data.adminId).toBe("admin-1")
      expect(result.data.targetUserId).toBe("target-1")
      expect(result.data.targetEmail).toBe("target@example.com")
    }
  })

  it("returns FORBIDDEN when caller is not admin", async () => {
    const result = await startImpersonation({ admin: nonAdmin, targetUserId: "target-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
  })

  it("returns VALIDATION_ERROR when impersonating yourself", async () => {
    const result = await startImpersonation({ admin, targetUserId: "admin-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
  })

  it("returns NOT_FOUND when the target user does not exist", async () => {
    mockSupabaseAdminUser(null)
    const result = await startImpersonation({ admin, targetUserId: "ghost" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
  })

  it("blocks the demo account from impersonating a real (non-demo) user", async () => {
    const demoAdmin = { id: "demo-1", role: "admin", email: "demo@demo.basekit.test" } as unknown as AuthUser
    mockSupabaseAdminUser({ id: "target-1", email: "real@example.com" })
    const result = await startImpersonation({ admin: demoAdmin, targetUserId: "target-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
  })

  it("lets the demo account impersonate another demo account", async () => {
    const demoAdmin = { id: "demo-1", role: "admin", email: "demo@demo.basekit.test" } as unknown as AuthUser
    mockSupabaseAdminUser({ id: "demo-target", email: "nova@demo.basekit.test" })
    const result = await startImpersonation({ admin: demoAdmin, targetUserId: "demo-target" })
    expect(result.ok).toBe(true)
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(true)
  })
})

describe("getImpersonationContext", () => {
  it("returns null when no cookie is present", async () => {
    expect(await getImpersonationContext()).toBeNull()
  })

  it("returns context when the cookie is valid and not expired", async () => {
    await startImpersonation({ admin, targetUserId: "target-1" })
    const context = await getImpersonationContext()
    expect(context).not.toBeNull()
    expect(context?.adminId).toBe("admin-1")
    expect(context?.targetUserId).toBe("target-1")
    expect(context?.targetEmail).toBe("target@example.com")
    expect(context?.expiresAt).toBeGreaterThan(Date.now())
  })

  it("returns null when the cookie is expired", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-04T00:00:00Z"))
    await startImpersonation({ admin, targetUserId: "target-1" })
    // Advance past the 30-minute TTL
    vi.setSystemTime(new Date("2026-06-04T01:00:00Z"))
    expect(await getImpersonationContext()).toBeNull()
  })

  it("returns null when the cookie signature is invalid", async () => {
    jar.set(IMPERSONATION_COOKIE, "tampered.invalid.token")
    expect(await getImpersonationContext()).toBeNull()
  })
})

describe("endImpersonation", () => {
  it("clears the cookie and returns the cleared context", async () => {
    await startImpersonation({ admin, targetUserId: "target-1" })
    const cleared = await endImpersonation()
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
    expect(cleared?.targetUserId).toBe("target-1")
  })

  it("returns null when there was no active impersonation", async () => {
    expect(await endImpersonation()).toBeNull()
    expect(jar.has(IMPERSONATION_COOKIE)).toBe(false)
  })
})
