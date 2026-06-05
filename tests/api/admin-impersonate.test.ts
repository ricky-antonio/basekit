import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  startImpersonation: vi.fn(),
  endImpersonation: vi.fn(),
  logActivity: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@/lib/impersonation", () => ({
  startImpersonation: mocks.startImpersonation,
  endImpersonation: mocks.endImpersonation,
}))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))

import { POST as startPOST } from "@/app/api/admin/users/[id]/impersonate/route"
import { POST as endPOST } from "@/app/api/admin/impersonate/end/route"

const admin = { id: "admin-1", role: "admin" }
const context = {
  adminId: "admin-1",
  targetUserId: "target-1",
  targetEmail: "target@example.com",
  expiresAt: Date.now() + 1000,
}

function ctx() {
  return { params: Promise.resolve({ id: "target-1" }) }
}

function startReq(): Request {
  return new Request("http://localhost/api/admin/users/target-1/impersonate", { method: "POST" })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdmin.mockResolvedValue({ ok: true, data: admin })
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.startImpersonation.mockResolvedValue({ ok: true, data: context })
  mocks.endImpersonation.mockResolvedValue(context)
})

describe("POST /api/admin/users/[id]/impersonate", () => {
  it("returns 403 when not admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: { error: "no", code: "FORBIDDEN" } })
    const response = await startPOST(startReq(), ctx())
    expect(response.status).toBe(403)
    expect(mocks.startImpersonation).not.toHaveBeenCalled()
  })

  it("sets the impersonation cookie on success", async () => {
    const response = await startPOST(startReq(), ctx())
    expect(response.status).toBe(200)
    expect(mocks.startImpersonation).toHaveBeenCalledWith({ admin, targetUserId: "target-1" })
  })

  it("logs admin.impersonation_started activity", async () => {
    await startPOST(startReq(), ctx())
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.impersonation_started",
        actorId: "admin-1",
        impersonatorId: "admin-1",
        targetId: "target-1",
      }),
    )
  })

  it("returns 429 when rate-limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow", code: "RATE_LIMITED" } })
    const response = await startPOST(startReq(), ctx())
    expect(response.status).toBe(429)
    expect(mocks.startImpersonation).not.toHaveBeenCalled()
  })

  it("propagates a VALIDATION_ERROR (e.g. self-impersonation) as 400 and does not log", async () => {
    mocks.startImpersonation.mockResolvedValue({ ok: false, error: { error: "self", code: "VALIDATION_ERROR" } })
    const response = await startPOST(startReq(), ctx())
    expect(response.status).toBe(400)
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
})

describe("POST /api/admin/impersonate/end", () => {
  it("clears the cookie and logs admin.impersonation_ended", async () => {
    const response = await endPOST()
    expect(response.status).toBe(200)
    expect(mocks.endImpersonation).toHaveBeenCalled()
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.impersonation_ended",
        actorId: "admin-1",
        impersonatorId: "admin-1",
        targetId: "target-1",
      }),
    )
  })

  it("returns 200 without logging when there was no active impersonation", async () => {
    mocks.endImpersonation.mockResolvedValue(null)
    const response = await endPOST()
    expect(response.status).toBe(200)
    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
})
