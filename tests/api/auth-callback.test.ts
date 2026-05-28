import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { GET } from "@/app/(auth)/callback/route"
import { mockSupabase, resetSupabaseMock } from "@/tests/mocks/supabase"
import type { User } from "@supabase/supabase-js"

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  bootstrapWorkspace: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
}))

vi.mock("@/lib/workspace", () => ({
  getWorkspace: mocks.getWorkspace,
  bootstrapWorkspace: mocks.bootstrapWorkspace,
}))

const BASE_URL = "http://localhost:3000"

function makeRequest(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params)
  return new Request(`${BASE_URL}/callback?${search.toString()}`) as unknown as NextRequest
}

const fakeUser: Partial<User> = {
  id: "user-1",
  email: "user@example.com",
  user_metadata: { display_name: "Test User" },
}

const fakeWorkspace = {
  id: "ws-1",
  name: "Test Workspace",
  slug: "test-workspace",
  owner_id: "user-1",
  created_at: new Date().toISOString(),
}

describe("GET /callback", () => {
  beforeEach(() => {
    resetSupabaseMock()
    mocks.getWorkspace.mockReset()
    mocks.bootstrapWorkspace.mockReset()
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockReset()
  })

  it("redirects to /dashboard on first sign-in", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: false, error: { error: "Not found", code: "NOT_FOUND" } })
    mocks.bootstrapWorkspace.mockResolvedValue({ ok: true, data: "ws-1" })

    const response = await GET(makeRequest({ code: "test-code" }))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/dashboard`)
  })

  it("calls bootstrapWorkspace on first sign-in", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: false, error: { error: "Not found", code: "NOT_FOUND" } })
    mocks.bootstrapWorkspace.mockResolvedValue({ ok: true, data: "ws-1" })

    await GET(makeRequest({ code: "test-code" }))

    expect(mocks.bootstrapWorkspace).toHaveBeenCalledWith("user-1", "user@example.com")
  })

  it("does NOT call bootstrapWorkspace on subsequent sign-in", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: true, data: fakeWorkspace })

    const response = await GET(makeRequest({ code: "test-code" }))

    expect(mocks.bootstrapWorkspace).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/dashboard`)
  })

  it("redirects to /login?error=auth_failed on code exchange failure", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: null, session: null } as any,
      error: { message: "Invalid code", name: "AuthApiError", status: 400 } as any,
    })

    const response = await GET(makeRequest({ code: "bad-code" }))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/login?error=auth_failed`)
  })

  it("redirects to /login?error=missing_code when code is absent", async () => {
    const response = await GET(makeRequest({}))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/login?error=missing_code`)
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("surfaces provider error (e.g. access_denied) to /login", async () => {
    const response = await GET(makeRequest({ error: "access_denied" }))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`${BASE_URL}/login?error=access_denied`)
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("honors a safe ?next path on success", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: true, data: fakeWorkspace })

    const response = await GET(makeRequest({ code: "test-code", next: "/reset-password" }))

    expect(response.headers.get("location")).toBe(`${BASE_URL}/reset-password`)
  })

  it("rejects open-redirect via // and falls back to /dashboard", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: true, data: fakeWorkspace })

    const response = await GET(makeRequest({ code: "test-code", next: "//evil.com" }))

    expect(response.headers.get("location")).toBe(`${BASE_URL}/dashboard`)
  })

  it("rejects open-redirect via backslash variant and falls back to /dashboard", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: true, data: fakeWorkspace })

    const response = await GET(makeRequest({ code: "test-code", next: "/\\evil.com" }))

    expect(response.headers.get("location")).toBe(`${BASE_URL}/dashboard`)
  })

  it("redirects to /login?error=workspace_failed if bootstrap fails", async () => {
    vi.mocked(mockSupabase.auth.exchangeCodeForSession).mockResolvedValue({
      data: { user: fakeUser as User, session: null },
      error: null,
    })
    mocks.getWorkspace.mockResolvedValue({ ok: false, error: { error: "Not found", code: "NOT_FOUND" } })
    mocks.bootstrapWorkspace.mockResolvedValue({
      ok: false,
      error: { error: "DB down", code: "INTERNAL_ERROR" },
    })

    const response = await GET(makeRequest({ code: "test-code" }))

    expect(response.headers.get("location")).toBe(`${BASE_URL}/login?error=workspace_failed`)
  })
})
