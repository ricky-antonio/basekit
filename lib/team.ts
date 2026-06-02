import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { decrementUsage } from "@/lib/usage"
import { logActivity } from "@/lib/activity"
import type { ApiResult, WorkspaceMemberRole } from "@/lib/types"

// The RLS-respecting server client type, derived so helpers can be typed without
// restating Supabase's generic parameters. Exported for the invitations module.
export type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface TeamMember {
  id: string
  userId: string
  role: WorkspaceMemberRole
  joinedAt: string
}

// A member row enriched with the profile + auth fields the team UI displays.
// `email` lives in auth.users and `display_name`/`avatar_url` in another user's
// profiles row — both unreadable under RLS by a teammate — so the enrichment is
// service-role-only (see listTeamMembers).
export interface EnrichedMember {
  id: string
  userId: string
  role: WorkspaceMemberRole
  joinedAt: string
  displayName: string
  email: string | null
  avatarUrl: string | null
}

export interface MemberRole {
  userId: string
  role: WorkspaceMemberRole
}

// A workspace has at most `memberLimit` rows (≤10 on Pro), so reading the whole
// member set once — then deriving both the actor's role and the target's role from
// it — is cheaper and simpler than two separate single-row lookups.
export async function fetchMembers(
  supabase: ServerClient,
  workspaceId: string,
): Promise<MemberRole[] | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)

  if (error) {
    console.error("[team.fetchMembers] failed", error)
    Sentry.captureException(error)
    return null
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    role: row.role as WorkspaceMemberRole,
  }))
}

export function isOwnerOrAdmin(role: WorkspaceMemberRole | undefined): boolean {
  return role === "owner" || role === "admin"
}

export async function listMembers(workspaceId: string): Promise<ApiResult<TeamMember[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true })

  if (error) {
    console.error("[team.listMembers] failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load members. Please try again.", code: "INTERNAL_ERROR" } }
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role as WorkspaceMemberRole,
      joinedAt: row.joined_at,
    })),
  }
}

// Members enriched with display name, avatar, and email for the team UI. RLS lets a
// member read the roster (workspace_members) and their OWN profile, but not other
// members' profiles or any auth.users email — so enrichment runs as the service role
// and MUST be called only from a route handler that has already confirmed the caller
// is a member of `workspaceId`.
export async function listTeamMembers(
  workspaceId: string,
): Promise<ApiResult<EnrichedMember[]>> {
  const supabase = createServiceClient()

  const { data: rows, error } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true })

  if (error) {
    console.error("[team.listTeamMembers] roster failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load members. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const roster = rows ?? []
  const userIds = roster.map((row) => row.user_id)

  if (userIds.length === 0) {
    return { ok: true, data: [] }
  }

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds)

  const profiles = new Map(
    (profileRows ?? []).map((p) => [p.id, { displayName: p.display_name, avatarUrl: p.avatar_url }]),
  )

  // Bounded by member count (≤10 on Pro). Emails are only in auth.users — resolved
  // one-by-one via the admin API, mirroring inviteMember's already-a-member check.
  const accounts = await Promise.all(
    userIds.map(async (id) => {
      const { data } = await supabase.auth.admin.getUserById(id)
      return [id, data?.user?.email ?? null] as const
    }),
  )
  const emails = new Map(accounts)

  return {
    ok: true,
    data: roster.map((row) => {
      const profile = profiles.get(row.user_id)
      const email = emails.get(row.user_id) ?? null
      return {
        id: row.id,
        userId: row.user_id,
        role: row.role as WorkspaceMemberRole,
        joinedAt: row.joined_at,
        displayName: profile?.displayName ?? email ?? "Member",
        email,
        avatarUrl: profile?.avatarUrl ?? null,
      }
    }),
  }
}

export interface RemoveMemberParams {
  workspaceId: string
  memberUserId: string
  actorId: string
}

export async function removeMember(
  params: RemoveMemberParams,
): Promise<ApiResult<{ workspaceId: string }>> {
  const { workspaceId, memberUserId, actorId } = params
  const supabase = await createClient()

  const members = await fetchMembers(supabase, workspaceId)
  if (members === null) {
    return { ok: false, error: { error: "Could not remove the member. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const actorRole = members.find((m) => m.userId === actorId)?.role
  const target = members.find((m) => m.userId === memberUserId)

  if (!target) {
    return { ok: false, error: { error: "Member not found.", code: "NOT_FOUND" } }
  }
  if (target.role === "owner") {
    return { ok: false, error: { error: "The workspace owner cannot be removed.", code: "FORBIDDEN" } }
  }
  if (!isOwnerOrAdmin(actorRole)) {
    return { ok: false, error: { error: "Only workspace owners and admins can remove members.", code: "FORBIDDEN" } }
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)

  if (error) {
    console.error("[team.removeMember] delete failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not remove the member. Please try again.", code: "INTERNAL_ERROR" } }
  }

  await decrementUsage(workspaceId, "members")

  await logActivity({
    workspaceId,
    actorId,
    action: "member.removed",
    targetType: "member",
    targetId: memberUserId,
    metadata: { role: target.role },
  })

  return { ok: true, data: { workspaceId } }
}

export interface ChangeMemberRoleParams {
  workspaceId: string
  memberUserId: string
  newRole: WorkspaceMemberRole
  actorId: string
}

export async function changeMemberRole(
  params: ChangeMemberRoleParams,
): Promise<ApiResult<{ workspaceId: string }>> {
  const { workspaceId, memberUserId, newRole, actorId } = params
  const supabase = await createClient()

  const members = await fetchMembers(supabase, workspaceId)
  if (members === null) {
    return { ok: false, error: { error: "Could not change the role. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const actorRole = members.find((m) => m.userId === actorId)?.role
  const target = members.find((m) => m.userId === memberUserId)

  if (!target) {
    return { ok: false, error: { error: "Member not found.", code: "NOT_FOUND" } }
  }
  // v1 has exactly one owner per workspace, so the owner is always the only owner —
  // changing their role would leave the workspace ownerless.
  if (target.role === "owner") {
    return { ok: false, error: { error: "The workspace owner's role cannot be changed.", code: "FORBIDDEN" } }
  }
  if (!isOwnerOrAdmin(actorRole)) {
    return { ok: false, error: { error: "Only workspace owners and admins can change roles.", code: "FORBIDDEN" } }
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)

  if (error) {
    console.error("[team.changeMemberRole] update failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not change the role. Please try again.", code: "INTERNAL_ERROR" } }
  }

  await logActivity({
    workspaceId,
    actorId,
    action: "member.role_changed",
    targetType: "member",
    targetId: memberUserId,
    metadata: { from: target.role, to: newRole },
  })

  return { ok: true, data: { workspaceId } }
}
