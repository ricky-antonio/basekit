import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

import { getProfile, updateProfile, uploadAvatar, deleteAccount } from "@/lib/profile"

const userId = "user-123"

const profileRow = {
  id: userId,
  display_name: "Alice",
  avatar_url: null,
  role: "user",
  updated_at: "2026-01-01T00:00:00Z",
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("getProfile", () => {
  it("returns the profile when found", async () => {
    mockSupabaseFrom("profiles", { data: profileRow, error: null })
    const result = await getProfile(userId)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.display_name).toBe("Alice")
  })

  it("returns NOT_FOUND when profile is missing", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "not found" } })
    const result = await getProfile(userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })
})

describe("updateProfile", () => {
  it("updates display_name and returns the profile", async () => {
    const updated = { ...profileRow, display_name: "Bob" }
    mockSupabaseFrom("profiles", { data: updated, error: null })
    const result = await updateProfile(userId, "Bob")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.display_name).toBe("Bob")
  })

  it("returns INTERNAL_ERROR when the update fails", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "db error" } })
    const result = await updateProfile(userId, "Bob")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("uploadAvatar", () => {
  it("returns VALIDATION_ERROR for oversized files", async () => {
    const bigFile = new File(["x".repeat(3 * 1024 * 1024)], "big.png", { type: "image/png" })
    const result = await uploadAvatar(userId, bigFile)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
  })

  it("returns VALIDATION_ERROR for non-image MIME types", async () => {
    const pdfFile = new File(["data"], "doc.pdf", { type: "application/pdf" })
    const result = await uploadAvatar(userId, pdfFile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.error).toContain("JPEG")
    }
  })

  it("returns the public URL on successful upload", async () => {
    mockSupabaseFrom("profiles", { data: profileRow, error: null })
    const validFile = new File(["img"], "avatar.png", { type: "image/png" })
    const result = await uploadAvatar(userId, validFile)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toContain("avatars")
  })

  it("returns INTERNAL_ERROR when storage upload fails", async () => {
    mockSupabaseFrom("profiles", { data: profileRow, error: null })
    const stickyHandler = {
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: "upload failed" } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "u" } }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as ReturnType<typeof mockSupabase.storage.from>
    vi.mocked(mockSupabase.storage.from).mockReturnValue(stickyHandler)
    const validFile = new File(["img"], "avatar.png", { type: "image/png" })
    const result = await uploadAvatar(userId, validFile)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("rejects image/gif (storage bucket does not allow it)", async () => {
    const gifFile = new File(["data"], "anim.gif", { type: "image/gif" })
    const result = await uploadAvatar(userId, gifFile)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.error).not.toContain("GIF")
    }
  })

  it("cleans up stale avatar files with different extensions", async () => {
    mockSupabaseFrom("profiles", { data: profileRow, error: null })
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null })
    const stickyHandler = {
      upload: vi.fn().mockResolvedValue({ data: { path: "p" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "u" } }),
      list: vi.fn().mockResolvedValue({
        data: [{ name: "avatar.png" }, { name: "avatar.webp" }],
        error: null,
      }),
      remove: removeMock,
    } as ReturnType<typeof mockSupabase.storage.from>
    vi.mocked(mockSupabase.storage.from).mockReturnValue(stickyHandler)
    const file = new File(["img"], "new.jpg", { type: "image/jpeg" })
    await uploadAvatar(userId, file)
    expect(removeMock).toHaveBeenCalledWith([
      `${userId}/avatar.png`,
      `${userId}/avatar.webp`,
    ])
  })
})

describe("deleteAccount", () => {
  it("returns ok:true when deletion succeeds", async () => {
    vi.mocked(mockSupabase.auth.admin.deleteUser).mockResolvedValueOnce({ data: { user: null }, error: null })
    const result = await deleteAccount(userId)
    expect(result.ok).toBe(true)
  })

  it("returns INTERNAL_ERROR when deletion fails", async () => {
    vi.mocked(mockSupabase.auth.admin.deleteUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: "delete failed", status: 500, __isAuthError: true, name: "AuthError", code: "internal_error" },
    })
    const result = await deleteAccount(userId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
