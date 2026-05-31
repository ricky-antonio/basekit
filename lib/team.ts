import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
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
