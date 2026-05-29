import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, resetSupabaseMock } from "@/tests/mocks/supabase"

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAccount: vi.fn(),
  updateWorkspace: vi.fn(),
  logActivity: vi.fn(),
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
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock("@/lib/workspace", () => ({
  getWorkspace: mocks.getWorkspace,
}))

vi.mock("@/lib/profile", () => ({
  updateProfile: mocks.updateProfile,
  uploadAvatar: mocks.uploadAvatar,
  deleteAccount: mocks.deleteAccount,
}))

vi.mock("@/lib/workspace-settings", () => ({
  updateWorkspace: mocks.updateWorkspace,
}))

vi.mock("@/lib/activity", () => ({
  logActivity: mocks.logActivity,
}))

const {
  updateProfileAction,
  uploadAvatarAction,
  updateWorkspaceAction,
  changePasswordAction,
  deleteAccountAction,
} = await import("@/app/(app)/settings/actions")

const user = { id: "user-1", email: "alice@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "user-1", created_at: "" }

function formData(record: Record<string, FormDataEntryValue>): FormData {
  const fd = new FormData()
  Object.entries(record).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  resetSupabaseMock()
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.logActivity.mockResolvedValue(undefined)
  vi.mocked(mockSupabase.auth.signInWithPassword).mockReset()
  vi.mocked(mockSupabase.auth.updateUser).mockReset()
})

describe("updateProfileAction", () => {
  it("returns UNAUTHENTICATED when not signed in", async () => {
    mocks.requireAuth.mockResolvedValueOnce({
      ok: false,
      error: { error: "no auth", code: "UNAUTHENTICATED" },
    })
    const result = await updateProfileAction(formData({ displayName: "Alice" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED")
  })

  it("returns RATE_LIMITED when over the threshold", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      error: { error: "too many", code: "RATE_LIMITED" },
    })
    const result = await updateProfileAction(formData({ displayName: "Alice" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
  })

  it("returns VALIDATION_ERROR for empty displayName", async () => {
    const result = await updateProfileAction(formData({ displayName: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.displayName).toBeTruthy()
    }
  })

  it("calls updateProfile with the user id and trimmed name", async () => {
    mocks.updateProfile.mockResolvedValueOnce({ ok: true, data: {} })
    const result = await updateProfileAction(formData({ displayName: "  Alice  " }))
    expect(result.ok).toBe(true)
    expect(mocks.updateProfile).toHaveBeenCalledWith("user-1", "Alice")
  })
})

describe("uploadAvatarAction", () => {
  it("returns VALIDATION_ERROR when no file is provided", async () => {
    const fd = new FormData()
    fd.set("avatar", new File([], "empty"))
    const result = await uploadAvatarAction(fd)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns RATE_LIMITED when over the threshold", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      error: { error: "slow down", code: "RATE_LIMITED" },
    })
    const fd = new FormData()
    fd.set("avatar", new File(["x"], "a.png", { type: "image/png" }))
    const result = await uploadAvatarAction(fd)
    expect(result.ok).toBe(false)
  })

  it("forwards a valid File to uploadAvatar", async () => {
    mocks.uploadAvatar.mockResolvedValueOnce({ ok: true, data: "https://example.com/a.png" })
    const fd = new FormData()
    fd.set("avatar", new File(["x"], "a.png", { type: "image/png" }))
    const result = await uploadAvatarAction(fd)
    expect(result.ok).toBe(true)
    expect(mocks.uploadAvatar).toHaveBeenCalledWith("user-1", expect.any(File))
  })
})

describe("updateWorkspaceAction", () => {
  it("returns VALIDATION_ERROR for invalid slug", async () => {
    const result = await updateWorkspaceAction(formData({ name: "Acme", slug: "Bad Slug!" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
  })

  it("calls updateWorkspace with workspaceId, userId, name, slug", async () => {
    mocks.updateWorkspace.mockResolvedValueOnce({ ok: true, data: workspace })
    const result = await updateWorkspaceAction(formData({ name: "Acme", slug: "acme" }))
    expect(result.ok).toBe(true)
    expect(mocks.updateWorkspace).toHaveBeenCalledWith("ws-1", "user-1", "Acme", "acme")
    expect(mocks.logActivity).toHaveBeenCalled()
  })

  it("propagates FORBIDDEN from updateWorkspace", async () => {
    mocks.updateWorkspace.mockResolvedValueOnce({
      ok: false,
      error: { error: "nope", code: "FORBIDDEN" },
    })
    const result = await updateWorkspaceAction(formData({ name: "Acme", slug: "acme" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
})

describe("changePasswordAction", () => {
  it("returns VALIDATION_ERROR when new password too short", async () => {
    const result = await changePasswordAction(
      formData({ currentPassword: "old", password: "short", confirmPassword: "short" }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns VALIDATION_ERROR when passwords do not match", async () => {
    const result = await changePasswordAction(
      formData({
        currentPassword: "oldpass",
        password: "newpass123",
        confirmPassword: "different123",
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.confirmPassword).toBeTruthy()
    }
  })

  it("returns VALIDATION_ERROR when current password is incorrect", async () => {
    vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: "bad creds",
        status: 400,
        __isAuthError: true,
        name: "AuthError",
        code: "invalid_credentials",
      },
    })
    const result = await changePasswordAction(
      formData({
        currentPassword: "wrongpass",
        password: "newpass123",
        confirmPassword: "newpass123",
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.currentPassword).toBeTruthy()
    }
  })

  it("returns FORBIDDEN when the account has no email", async () => {
    mocks.requireAuth.mockResolvedValueOnce({ ok: true, data: { id: "u", email: undefined } })
    const result = await changePasswordAction(
      formData({
        currentPassword: "oldpass",
        password: "newpass123",
        confirmPassword: "newpass123",
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
  })

  it("succeeds and calls updateUser with the new password", async () => {
    vi.mocked(mockSupabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: { id: "u" }, session: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.signInWithPassword>>)
    vi.mocked(mockSupabase.auth.updateUser).mockResolvedValueOnce({
      data: { user: { id: "u" } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof mockSupabase.auth.updateUser>>)
    const result = await changePasswordAction(
      formData({
        currentPassword: "oldpass",
        password: "newpass123",
        confirmPassword: "newpass123",
      }),
    )
    expect(result.ok).toBe(true)
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: "newpass123" })
  })
})

describe("deleteAccountAction", () => {
  it("returns UNAUTHENTICATED when not signed in", async () => {
    mocks.requireAuth.mockResolvedValueOnce({
      ok: false,
      error: { error: "no auth", code: "UNAUTHENTICATED" },
    })
    const result = await deleteAccountAction()
    expect(result.ok).toBe(false)
  })

  it("returns the lib error when delete fails", async () => {
    mocks.deleteAccount.mockResolvedValueOnce({
      ok: false,
      error: { error: "boom", code: "INTERNAL_ERROR" },
    })
    const result = await deleteAccountAction()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("redirects to /login on success", async () => {
    mocks.deleteAccount.mockResolvedValueOnce({ ok: true, data: undefined })
    await expect(deleteAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login")
    expect(mocks.redirect).toHaveBeenCalledWith("/login")
  })
})
