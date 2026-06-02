import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getInvitationByToken: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock("@/lib/invitations", () => ({ getInvitationByToken: mocks.getInvitationByToken }))
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }))

import { GET } from "@/app/api/team/invitation/route"

const preview = {
  status: "valid" as const,
  workspaceName: "Acme",
  inviterName: "Ada",
  email: "invitee@example.com",
  role: "member" as const,
}

function request(query: string): Request {
  return new Request(`http://localhost/api/team/invitation${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ success: true })
  mocks.getInvitationByToken.mockResolvedValue(preview)
})

describe("GET /api/team/invitation", () => {
  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: { error: "slow down", code: "RATE_LIMITED" } })
    expect((await GET(request("?token=tok"))).status).toBe(429)
    expect(mocks.getInvitationByToken).not.toHaveBeenCalled()
  })

  it("returns 400 when the token is missing", async () => {
    const response = await GET(request(""))
    expect(response.status).toBe(400)
    expect(mocks.getInvitationByToken).not.toHaveBeenCalled()
  })

  it("returns the preview for a valid token", async () => {
    const response = await GET(request("?token=tok"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(preview)
    expect(mocks.getInvitationByToken).toHaveBeenCalledWith("tok")
  })

  it("returns 200 with not_found rather than erroring for an unknown token", async () => {
    mocks.getInvitationByToken.mockResolvedValue({ status: "not_found", workspaceName: null, inviterName: null, email: null, role: null })
    const response = await GET(request("?token=ghost"))
    expect(response.status).toBe(200)
    expect((await response.json()).status).toBe("not_found")
  })
})
