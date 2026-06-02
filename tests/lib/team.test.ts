import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseFrom,
  mockSupabaseAdminUser,
  getLastWrite,
  getSupabaseFilters,
  resetSupabaseMock,
} from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

const mocks = vi.hoisted(() => ({
  canAddMember: vi.fn(),
  incrementUsage: vi.fn(),
  decrementUsage: vi.fn(),
  sendTeamInvitationEmail: vi.fn(),
  logActivity: vi.fn(),
}))

vi.mock("@/lib/usage", () => ({
  canAddMember: mocks.canAddMember,
  incrementUsage: mocks.incrementUsage,
  decrementUsage: mocks.decrementUsage,
}))
vi.mock("@/lib/email", () => ({ sendTeamInvitationEmail: mocks.sendTeamInvitationEmail }))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { listMembers, listTeamMembers, removeMember, changeMemberRole } from "@/lib/team"
import { listPendingInvitations, inviteMember, revokeInvitation } from "@/lib/invitations"
import { acceptInvitation, getInvitationByToken } from "@/lib/invitation-accept"

const WORKSPACE_ID = "ws-1"
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function ownerMembers() {
  mockSupabaseFrom("workspace_members", {
    data: [{ user_id: "owner-1", role: "owner" }],
    error: null,
  })
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
  mocks.canAddMember.mockResolvedValue(true)
  mocks.incrementUsage.mockResolvedValue(undefined)
  mocks.decrementUsage.mockResolvedValue(undefined)
  mocks.sendTeamInvitationEmail.mockResolvedValue({ ok: true, data: { id: "email-1" } })
  mocks.logActivity.mockResolvedValue(undefined)
})

describe("listMembers", () => {
  it("returns rows for workspace", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [{ id: "m1", user_id: "owner-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" }],
      error: null,
    })

    const result = await listMembers(WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toEqual({
        id: "m1",
        userId: "owner-1",
        role: "owner",
        joinedAt: "2026-01-01T00:00:00Z",
      })
    }
  })
})

describe("listPendingInvitations", () => {
  it("excludes accepted ones (filters accepted_at is null)", async () => {
    mockSupabaseFrom("invitations", {
      data: [
        {
          id: "inv-1",
          email: "a@example.com",
          role: "member",
          invited_by: "owner-1",
          expires_at: FUTURE,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    })

    const result = await listPendingInvitations(WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(1)
    expect(getSupabaseFilters("invitations")).toContainEqual({
      table: "invitations",
      method: "is",
      args: ["accepted_at", null],
    })
  })
})

describe("inviteMember", () => {
  const baseParams = {
    workspaceId: WORKSPACE_ID,
    workspaceName: "Acme",
    email: "new@example.com",
    role: "member" as const,
    invitedBy: "owner-1",
    inviterEmail: "owner@example.com",
  }

  it("returns LIMIT_EXCEEDED at member cap", async () => {
    ownerMembers()
    mocks.canAddMember.mockResolvedValue(false)

    const result = await inviteMember(baseParams)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("LIMIT_EXCEEDED")
      expect(result.error.upgradeUrl).toBe("/settings/billing")
    }
    expect(getLastWrite("invitations", "insert")).toBeUndefined()
  })

  it("inserts invitation and sends email", async () => {
    ownerMembers()
    mockSupabaseAdminUser({ id: "owner-1", email: "owner@example.com" })
    mockSupabaseFrom("invitations", {
      data: {
        id: "inv-1",
        email: "new@example.com",
        role: "member",
        token: "tok-123",
        expires_at: FUTURE,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    })

    const result = await inviteMember(baseParams)

    expect(result.ok).toBe(true)
    expect(getLastWrite("invitations", "insert")?.payload).toMatchObject({
      workspace_id: WORKSPACE_ID,
      email: "new@example.com",
      role: "member",
      invited_by: "owner-1",
    })
    expect(mocks.sendTeamInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        workspaceName: "Acme",
        acceptUrl: expect.stringContaining("token=tok-123"),
      }),
    )
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.invited", targetId: "inv-1" }),
    )
  })

  it("returns FORBIDDEN when caller is a plain member", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [{ user_id: "member-1", role: "member" }],
      error: null,
    })

    const result = await inviteMember({ ...baseParams, invitedBy: "member-1" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.canAddMember).not.toHaveBeenCalled()
  })

  it("returns VALIDATION_ERROR for an invalid email", async () => {
    const result = await inviteMember({ ...baseParams, email: "not-an-email" })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.email).toBeTruthy()
    }
    expect(mockSupabase.from).not.toHaveBeenCalledWith("invitations")
  })

  it("returns ok=false when email is already a member", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [
        { user_id: "owner-1", role: "owner" },
        { user_id: "bob", role: "member" },
      ],
      error: null,
    })
    mockSupabaseAdminUser({ id: "bob", email: "new@example.com" })

    const result = await inviteMember(baseParams)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
    expect(getLastWrite("invitations", "insert")).toBeUndefined()
  })

  it("returns ok=false when a pending invitation already exists", async () => {
    ownerMembers()
    mockSupabaseAdminUser({ id: "owner-1", email: "owner@example.com" })
    mockSupabaseFrom("invitations", {
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    })

    const result = await inviteMember(baseParams)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
    expect(mocks.sendTeamInvitationEmail).not.toHaveBeenCalled()
  })
})

describe("acceptInvitation", () => {
  it("returns NOT_FOUND for an unknown token", async () => {
    mockSupabaseFrom("invitations", { data: null, error: null })

    const result = await acceptInvitation({ token: "missing", userId: "u-9" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns ok=false for an expired token", async () => {
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", accepted_at: null, expires_at: PAST },
      error: null,
    })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
  })

  it("returns ok=false for an already-accepted token", async () => {
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", accepted_at: "2026-01-01T00:00:00Z", expires_at: FUTURE },
      error: null,
    })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR")
  })

  it("creates member, sets accepted_at, and increments usage", async () => {
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", accepted_at: null, expires_at: FUTURE },
      error: null,
    })
    mockSupabaseFrom("workspace_members", { data: null, error: null })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ workspaceId: WORKSPACE_ID, role: "member" })
    expect(getLastWrite("workspace_members", "insert")?.payload).toEqual({
      workspace_id: WORKSPACE_ID,
      user_id: "u-9",
      role: "member",
    })
    expect(getLastWrite("invitations", "update")?.payload).toHaveProperty("accepted_at")
    expect(mocks.incrementUsage).toHaveBeenCalledWith(WORKSPACE_ID, "members")
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.joined" }),
    )
  })
})

describe("removeMember", () => {
  it("decrements usage on success", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [
        { user_id: "owner-1", role: "owner" },
        { user_id: "bob", role: "member" },
      ],
      error: null,
    })

    const result = await removeMember({ workspaceId: WORKSPACE_ID, memberUserId: "bob", actorId: "owner-1" })

    expect(result.ok).toBe(true)
    expect(getLastWrite("workspace_members", "delete")).toBeDefined()
    expect(mocks.decrementUsage).toHaveBeenCalledWith(WORKSPACE_ID, "members")
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.removed", targetId: "bob" }),
    )
  })

  it("refuses to remove the owner", async () => {
    ownerMembers()

    const result = await removeMember({ workspaceId: WORKSPACE_ID, memberUserId: "owner-1", actorId: "owner-1" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(getLastWrite("workspace_members", "delete")).toBeUndefined()
    expect(mocks.decrementUsage).not.toHaveBeenCalled()
  })
})

describe("changeMemberRole", () => {
  it("refuses to demote the only owner", async () => {
    ownerMembers()

    const result = await changeMemberRole({
      workspaceId: WORKSPACE_ID,
      memberUserId: "owner-1",
      newRole: "member",
      actorId: "owner-1",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(getLastWrite("workspace_members", "update")).toBeUndefined()
  })
})

describe("revokeInvitation", () => {
  it("deletes a pending invitation", async () => {
    ownerMembers()
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, accepted_at: null },
      error: null,
    })

    const result = await revokeInvitation({ workspaceId: WORKSPACE_ID, invitationId: "inv-1", actorId: "owner-1" })

    expect(result.ok).toBe(true)
    expect(getLastWrite("invitations", "delete")).toBeDefined()
  })

  it("returns FORBIDDEN when caller is a plain member", async () => {
    mockSupabaseFrom("workspace_members", { data: [{ user_id: "m1", role: "member" }], error: null })

    const result = await revokeInvitation({ workspaceId: WORKSPACE_ID, invitationId: "inv-1", actorId: "m1" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
  })

  it("returns NOT_FOUND when the invitation does not exist", async () => {
    ownerMembers()
    mockSupabaseFrom("invitations", { data: null, error: null })

    const result = await revokeInvitation({ workspaceId: WORKSPACE_ID, invitationId: "ghost", actorId: "owner-1" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns INTERNAL_ERROR when the invitation lookup fails", async () => {
    ownerMembers()
    mockSupabaseFrom("invitations", { data: null, error: { message: "boom" } })

    const result = await revokeInvitation({ workspaceId: WORKSPACE_ID, invitationId: "inv-1", actorId: "owner-1" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("listMembers / listPendingInvitations error paths", () => {
  it("listMembers returns INTERNAL_ERROR on a DB error", async () => {
    mockSupabaseFrom("workspace_members", { data: null, error: { message: "down" } })
    const result = await listMembers(WORKSPACE_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("listPendingInvitations returns INTERNAL_ERROR on a DB error", async () => {
    mockSupabaseFrom("invitations", { data: null, error: { message: "down" } })
    const result = await listPendingInvitations(WORKSPACE_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("inviteMember error paths", () => {
  const baseParams = {
    workspaceId: WORKSPACE_ID,
    workspaceName: "Acme",
    email: "new@example.com",
    role: "member" as const,
    invitedBy: "owner-1",
    inviterEmail: "owner@example.com",
  }

  it("returns INTERNAL_ERROR when the member lookup fails", async () => {
    mockSupabaseFrom("workspace_members", { data: null, error: { message: "down" } })
    const result = await inviteMember(baseParams)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns INTERNAL_ERROR on a non-unique insert error", async () => {
    ownerMembers()
    mockSupabaseAdminUser({ id: "owner-1", email: "owner@example.com" })
    mockSupabaseFrom("invitations", { data: null, error: { message: "connection reset" } })

    const result = await inviteMember(baseParams)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
    expect(mocks.sendTeamInvitationEmail).not.toHaveBeenCalled()
  })
})

describe("acceptInvitation extra paths", () => {
  it("returns INTERNAL_ERROR when the lookup fails", async () => {
    mockSupabaseFrom("invitations", { data: null, error: { message: "down" } })
    const result = await acceptInvitation({ token: "tok", userId: "u-9" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("is idempotent when the user is already a member (no extra usage)", async () => {
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", accepted_at: null, expires_at: FUTURE },
      error: null,
    })
    mockSupabaseFrom("workspace_members", { data: { id: "existing" }, error: null })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(true)
    expect(getLastWrite("workspace_members", "insert")).toBeUndefined()
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
    expect(getLastWrite("invitations", "update")?.payload).toHaveProperty("accepted_at")
  })

  it("returns INTERNAL_ERROR when the membership insert fails", async () => {
    mockSupabaseFrom("invitations", {
      data: { id: "inv-1", workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", accepted_at: null, expires_at: FUTURE },
      error: null,
    })
    mockSupabaseFrom("workspace_members", { data: null, error: { message: "insert failed" } })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
  })
})

describe("removeMember extra paths", () => {
  it("returns INTERNAL_ERROR when the member lookup fails", async () => {
    mockSupabaseFrom("workspace_members", { data: null, error: { message: "down" } })
    const result = await removeMember({ workspaceId: WORKSPACE_ID, memberUserId: "bob", actorId: "owner-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns NOT_FOUND when the target member is absent", async () => {
    ownerMembers()
    const result = await removeMember({ workspaceId: WORKSPACE_ID, memberUserId: "ghost", actorId: "owner-1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns FORBIDDEN when the actor is a plain member", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [
        { user_id: "m1", role: "member" },
        { user_id: "bob", role: "member" },
      ],
      error: null,
    })
    const result = await removeMember({ workspaceId: WORKSPACE_ID, memberUserId: "bob", actorId: "m1" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
    expect(mocks.decrementUsage).not.toHaveBeenCalled()
  })
})

describe("changeMemberRole extra paths", () => {
  it("promotes a member to admin and logs the change", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [
        { user_id: "owner-1", role: "owner" },
        { user_id: "bob", role: "member" },
      ],
      error: null,
    })

    const result = await changeMemberRole({
      workspaceId: WORKSPACE_ID,
      memberUserId: "bob",
      newRole: "admin",
      actorId: "owner-1",
    })

    expect(result.ok).toBe(true)
    expect(getLastWrite("workspace_members", "update")?.payload).toEqual({ role: "admin" })
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.role_changed", metadata: { from: "member", to: "admin" } }),
    )
  })

  it("returns NOT_FOUND when the target member is absent", async () => {
    ownerMembers()
    const result = await changeMemberRole({
      workspaceId: WORKSPACE_ID,
      memberUserId: "ghost",
      newRole: "admin",
      actorId: "owner-1",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns FORBIDDEN when the actor is a plain member", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [
        { user_id: "m1", role: "member" },
        { user_id: "bob", role: "member" },
      ],
      error: null,
    })
    const result = await changeMemberRole({
      workspaceId: WORKSPACE_ID,
      memberUserId: "bob",
      newRole: "admin",
      actorId: "m1",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
  })
})

describe("listTeamMembers", () => {
  it("enriches the roster with profile name, avatar, and email", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [{ id: "m1", user_id: "owner-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" }],
      error: null,
    })
    mockSupabaseFrom("profiles", {
      data: [{ id: "owner-1", display_name: "Ada Owner", avatar_url: "https://cdn/a.png" }],
      error: null,
    })
    mockSupabaseAdminUser({ id: "owner-1", email: "owner@example.com" })

    const result = await listTeamMembers(WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([
        {
          id: "m1",
          userId: "owner-1",
          role: "owner",
          joinedAt: "2026-01-01T00:00:00Z",
          displayName: "Ada Owner",
          email: "owner@example.com",
          avatarUrl: "https://cdn/a.png",
        },
      ])
    }
  })

  it("falls back to the email when the profile name is missing", async () => {
    mockSupabaseFrom("workspace_members", {
      data: [{ id: "m2", user_id: "u-2", role: "member", joined_at: "2026-01-02T00:00:00Z" }],
      error: null,
    })
    mockSupabaseFrom("profiles", { data: [{ id: "u-2", display_name: null, avatar_url: null }], error: null })
    mockSupabaseAdminUser({ id: "u-2", email: "fallback@example.com" })

    const result = await listTeamMembers(WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]?.displayName).toBe("fallback@example.com")
      expect(result.data[0]?.avatarUrl).toBeNull()
    }
  })

  it("returns an empty list (no enrichment) for a memberless workspace", async () => {
    mockSupabaseFrom("workspace_members", { data: [], error: null })

    const result = await listTeamMembers(WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual([])
    expect(mockSupabase.auth.admin.getUserById).not.toHaveBeenCalled()
  })

  it("returns INTERNAL_ERROR when the roster query fails", async () => {
    mockSupabaseFrom("workspace_members", { data: null, error: { message: "down" } })

    const result = await listTeamMembers(WORKSPACE_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("getInvitationByToken", () => {
  it("returns valid with workspace + inviter for a live invitation", async () => {
    mockSupabaseFrom("invitations", {
      data: {
        workspace_id: WORKSPACE_ID,
        email: "invitee@example.com",
        role: "member",
        invited_by: "owner-1",
        accepted_at: null,
        expires_at: FUTURE,
      },
      error: null,
    })
    mockSupabaseFrom("workspaces", { data: { name: "Acme" }, error: null })
    mockSupabaseFrom("profiles", { data: { display_name: "Ada Owner" }, error: null })

    const preview = await getInvitationByToken("tok")

    expect(preview).toEqual({
      status: "valid",
      workspaceName: "Acme",
      inviterName: "Ada Owner",
      email: "invitee@example.com",
      role: "member",
    })
  })

  it("returns not_found for an unknown token", async () => {
    mockSupabaseFrom("invitations", { data: null, error: null })
    const preview = await getInvitationByToken("missing")
    expect(preview.status).toBe("not_found")
  })

  it("returns accepted for an already-accepted invitation", async () => {
    mockSupabaseFrom("invitations", {
      data: { workspace_id: WORKSPACE_ID, email: "x@y.com", role: "member", invited_by: "owner-1", accepted_at: "2026-01-01T00:00:00Z", expires_at: FUTURE },
      error: null,
    })
    const preview = await getInvitationByToken("tok")
    expect(preview.status).toBe("accepted")
    expect(preview.email).toBe("x@y.com")
  })

  it("returns expired for a past-expiry invitation", async () => {
    mockSupabaseFrom("invitations", {
      data: { workspace_id: WORKSPACE_ID, email: "x@y.com", role: "admin", invited_by: "owner-1", accepted_at: null, expires_at: PAST },
      error: null,
    })
    const preview = await getInvitationByToken("tok")
    expect(preview.status).toBe("expired")
    expect(preview.role).toBe("admin")
  })

  it("returns not_found on a lookup error", async () => {
    mockSupabaseFrom("invitations", { data: null, error: { message: "boom" } })
    const preview = await getInvitationByToken("tok")
    expect(preview.status).toBe("not_found")
  })
})

describe("acceptInvitation member-limit hardening", () => {
  const validInvite = {
    id: "inv-1",
    workspace_id: WORKSPACE_ID,
    email: "x@y.com",
    role: "member" as const,
    accepted_at: null,
    expires_at: FUTURE,
  }

  it("returns LIMIT_EXCEEDED when the workspace is at the member cap", async () => {
    mockSupabaseFrom("invitations", { data: validInvite, error: null })
    mockSupabaseFrom("workspace_members", { data: null, error: null })
    mockSupabaseFrom("subscriptions", { data: { plan_name: "pro", status: "active" }, error: null })
    mockSupabaseFrom("usage", { data: { count: 10 }, error: null })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("LIMIT_EXCEEDED")
    expect(getLastWrite("workspace_members", "insert")).toBeUndefined()
    expect(mocks.incrementUsage).not.toHaveBeenCalled()
    expect(getLastWrite("invitations", "update")).toBeUndefined()
  })

  it("allows accept when under the cap", async () => {
    mockSupabaseFrom("invitations", { data: validInvite, error: null })
    mockSupabaseFrom("workspace_members", { data: null, error: null })
    mockSupabaseFrom("subscriptions", { data: { plan_name: "pro", status: "active" }, error: null })
    mockSupabaseFrom("usage", { data: { count: 3 }, error: null })

    const result = await acceptInvitation({ token: "tok", userId: "u-9" })

    expect(result.ok).toBe(true)
    expect(getLastWrite("workspace_members", "insert")).toBeDefined()
    expect(mocks.incrementUsage).toHaveBeenCalledWith(WORKSPACE_ID, "members")
  })
})
