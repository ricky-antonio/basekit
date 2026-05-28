import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, resetSupabaseMock } from "@/tests/mocks/supabase"

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  redirect: vi.fn(),
  headers: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
}))

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mocks.redirect(path)
    // Match Next's real behavior: redirect() throws. Tests catch and inspect.
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}))

const fakeHeaders = {
  get: vi.fn((_key: string) => "1.2.3.4"),
}

const {
  loginAction,
  signupAction,
  forgotPasswordAction,
  resetPasswordAction,
} = await import("@/app/(auth)/actions")

function formData(record: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(record).forEach(([k, v]) => fd.set(k, v))
  return fd
}

async function expectRedirect(fn: () => Promise<unknown>, path: string) {
  await expect(fn()).rejects.toThrow(`NEXT_REDIRECT:${path}`)
  expect(mocks.redirect).toHaveBeenCalledWith(path)
}

beforeEach(() => {
  resetSupabaseMock()
  mocks.checkRateLimit.mockReset()
  mocks.redirect.mockReset()
  mocks.headers.mockReset().mockResolvedValue(fakeHeaders)
  vi.mocked(mockSupabase.auth.signInWithPassword).mockReset()
  vi.mocked(mockSupabase.auth.signUp).mockReset()
  vi.mocked(mockSupabase.auth.resetPasswordForEmail).mockReset()
  vi.mocked(mockSupabase.auth.updateUser).mockReset()
})

describe("loginAction", () => {
  it("returns RATE_LIMITED when limiter rejects", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: { error: "Too many requests", code: "RATE_LIMITED" },
    })
    const result = await loginAction(null, formData({ email: "a@b.co", password: "pw" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("returns VALIDATION_ERROR for invalid email", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    const result = await loginAction(null, formData({ email: "not-an-email", password: "pw" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.["email"]).toBeTruthy()
    }
  })

  it("returns UNAUTHENTICATED with generic message on Supabase auth error", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null } as any,
      error: { message: "Invalid login credentials" } as any,
    })
    const result = await loginAction(null, formData({ email: "a@b.co", password: "wrong" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHENTICATED")
      // Generic message — must not reveal whether the email exists
      expect(result.error.error).toBe("Wrong email or password.")
    }
  })

  it("redirects to /dashboard on success", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} } as any,
      error: null,
    })
    await expectRedirect(
      () => loginAction(null, formData({ email: "a@b.co", password: "longenough" })),
      "/dashboard",
    )
  })

  it("rate-limits by ip + email composite key", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "u1" }, session: {} } as any,
      error: null,
    })
    await expectRedirect(
      () => loginAction(null, formData({ email: "a@b.co", password: "longenough" })),
      "/dashboard",
    )
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("login", "1.2.3.4:a@b.co")
  })
})

describe("signupAction", () => {
  it("returns RATE_LIMITED when limiter rejects", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: { error: "Too many requests", code: "RATE_LIMITED" },
    })
    const result = await signupAction(
      null,
      formData({ displayName: "Jane", email: "a@b.co", password: "longenough" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
  })

  it("redirects to /verify-email on success", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    vi.mocked(mockSupabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "u1" }, session: null } as any,
      error: null,
    })
    await expectRedirect(
      () =>
        signupAction(
          null,
          formData({ displayName: "Jane", email: "a@b.co", password: "longenough" }),
        ),
      "/verify-email",
    )
  })

  it("rejects passwords shorter than 8 characters", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    const result = await signupAction(
      null,
      formData({ displayName: "Jane", email: "a@b.co", password: "short" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.fieldErrors?.["password"]).toBeTruthy()
    }
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled()
  })
})

describe("forgotPasswordAction", () => {
  it("returns RATE_LIMITED when limiter rejects", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: { error: "Too many requests", code: "RATE_LIMITED" },
    })
    const result = await forgotPasswordAction(null, formData({ email: "a@b.co" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
  })

  it("always redirects to ?sent=true even when Supabase errors (no email enumeration)", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: true })
    vi.mocked(mockSupabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: null,
      error: { message: "Email does not exist" } as any,
    } as any)
    await expectRedirect(
      () => forgotPasswordAction(null, formData({ email: "a@b.co" })),
      "/forgot-password?sent=true",
    )
  })
})

describe("resetPasswordAction", () => {
  it("rejects mismatched confirmation", async () => {
    const result = await resetPasswordAction(
      null,
      formData({ password: "longenough", confirmPassword: "different1" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.fieldErrors?.["confirmPassword"]).toBeTruthy()
    }
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it("redirects to /dashboard on success", async () => {
    vi.mocked(mockSupabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: "u1" } } as any,
      error: null,
    })
    await expectRedirect(
      () =>
        resetPasswordAction(
          null,
          formData({ password: "longenough", confirmPassword: "longenough" }),
        ),
      "/dashboard",
    )
  })

  it("surfaces a generic error when Supabase updateUser fails", async () => {
    vi.mocked(mockSupabase.auth.updateUser).mockResolvedValue({
      data: { user: null } as any,
      error: { message: "Password is too weak" } as any,
    })
    const result = await resetPasswordAction(
      null,
      formData({ password: "longenough", confirmPassword: "longenough" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
