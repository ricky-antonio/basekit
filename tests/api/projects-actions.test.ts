import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuth: vi.fn(),
  getWorkspace: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  logActivity: vi.fn(),
}))

vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mocks.redirect(path)
    throw new Error(`NEXT_REDIRECT:${path}`)
  },
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }))
vi.mock("@/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }))
vi.mock("@/lib/projects", () => ({
  createProject: mocks.createProject,
  deleteProject: mocks.deleteProject,
}))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))

const { createProjectAction, deleteProjectAction } = await import("@/app/(app)/projects/actions")

const user = { id: "user-1", email: "alice@example.com" }
const workspace = { id: "ws-1", name: "Acme", slug: "acme", owner_id: "user-1", created_at: "" }

function formData(record: Record<string, FormDataEntryValue>): FormData {
  const fd = new FormData()
  Object.entries(record).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.requireAuth.mockResolvedValue({ ok: true, data: user })
  mocks.getWorkspace.mockResolvedValue({ ok: true, data: workspace })
  mocks.logActivity.mockResolvedValue(undefined)
})

describe("createProjectAction", () => {
  it("returns UNAUTHENTICATED when not signed in", async () => {
    mocks.requireAuth.mockResolvedValueOnce({
      ok: false,
      error: { error: "no auth", code: "UNAUTHENTICATED" },
    })
    const result = await createProjectAction(formData({ name: "Alpha" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED")
    expect(mocks.createProject).not.toHaveBeenCalled()
  })

  it("returns RATE_LIMITED when over the threshold", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      error: { error: "too many", code: "RATE_LIMITED" },
    })
    const result = await createProjectAction(formData({ name: "Alpha" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
  })

  it("returns VALIDATION_ERROR for an empty name", async () => {
    const result = await createProjectAction(formData({ name: "  " }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.name).toBeTruthy()
    }
    expect(mocks.createProject).not.toHaveBeenCalled()
  })

  it("propagates LIMIT_EXCEEDED (with upgradeUrl) from createProject", async () => {
    mocks.createProject.mockResolvedValueOnce({
      ok: false,
      error: { error: "limit", code: "LIMIT_EXCEEDED", upgradeUrl: "/settings/billing" },
    })
    const result = await createProjectAction(formData({ name: "Alpha" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("LIMIT_EXCEEDED")
      expect(result.error.upgradeUrl).toBe("/settings/billing")
    }
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })

  it("logs activity and redirects to /projects on success", async () => {
    mocks.createProject.mockResolvedValueOnce({
      ok: true,
      data: { id: "p1", workspace_id: "ws-1", name: "Alpha", description: null, created_at: "" },
    })
    await expect(createProjectAction(formData({ name: "Alpha" }))).rejects.toThrow(
      "NEXT_REDIRECT:/projects",
    )
    expect(mocks.createProject).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Alpha",
      description: null,
    })
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project.created", targetId: "p1" }),
    )
    expect(mocks.redirect).toHaveBeenCalledWith("/projects")
  })
})

describe("deleteProjectAction", () => {
  it("returns UNAUTHENTICATED when not signed in", async () => {
    mocks.requireAuth.mockResolvedValueOnce({
      ok: false,
      error: { error: "no auth", code: "UNAUTHENTICATED" },
    })
    const result = await deleteProjectAction("p1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED")
    expect(mocks.deleteProject).not.toHaveBeenCalled()
  })

  it("returns RATE_LIMITED when over the threshold", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      error: { error: "too many", code: "RATE_LIMITED" },
    })
    const result = await deleteProjectAction("p1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("RATE_LIMITED")
  })

  it("propagates FORBIDDEN from deleteProject and does not log", async () => {
    mocks.deleteProject.mockResolvedValueOnce({
      ok: false,
      error: { error: "nope", code: "FORBIDDEN" },
    })
    const result = await deleteProjectAction("p1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })

  it("logs activity and redirects to /projects on success", async () => {
    mocks.deleteProject.mockResolvedValueOnce({ ok: true, data: { workspaceId: "ws-1" } })
    await expect(deleteProjectAction("p1")).rejects.toThrow("NEXT_REDIRECT:/projects")
    expect(mocks.deleteProject).toHaveBeenCalledWith("p1", "user-1")
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project.deleted", targetId: "p1" }),
    )
    expect(mocks.redirect).toHaveBeenCalledWith("/projects")
  })
})
