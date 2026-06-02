import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { canAddMember } from "@/lib/usage"
import { sendTeamInvitationEmail } from "@/lib/email"
import { logActivity } from "@/lib/activity"
import { inviteSchema } from "@/lib/validation/team"
import { zodFieldErrors } from "@/lib/validation/errors"
import { fetchMembers, isOwnerOrAdmin, type ServerClient } from "@/lib/team"
import type { ApiResult, WorkspaceMemberRole } from "@/lib/types"

// Owner-side invitation flows (create / list / revoke). The invitee-side accept +
// public token preview live in lib/invitation-accept.ts (service-role; the accepting
// user isn't a member yet, so RLS blocks those reads/writes).
const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"
const UPGRADE_URL = "/settings/billing"

export interface PendingInvitation {
  id: string
  email: string
  role: WorkspaceMemberRole
  invitedBy: string | null
  expiresAt: string
  createdAt: string
}

export interface CreatedInvitation {
  id: string
  email: string
  role: WorkspaceMemberRole
  expiresAt: string
  createdAt: string
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "")
}

async function resolveInviterName(
  supabase: ServerClient,
  userId: string,
  fallbackEmail?: string | null,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle()
  return data?.display_name ?? fallbackEmail ?? "A teammate"
}

export async function listPendingInvitations(
  workspaceId: string,
): Promise<ApiResult<PendingInvitation[]>> {
  const supabase = await createClient()

  // The token is the invite secret — never selected into a list other members can read.
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, invited_by, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[invitations.listPending] failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load invitations. Please try again.", code: "INTERNAL_ERROR" } }
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as WorkspaceMemberRole,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
  }
}

export interface InviteMemberParams {
  workspaceId: string
  workspaceName: string
  email: string
  role: WorkspaceMemberRole
  invitedBy: string
  inviterEmail?: string | null
}

export async function inviteMember(
  params: InviteMemberParams,
): Promise<ApiResult<CreatedInvitation>> {
  const { workspaceId, workspaceName, invitedBy, inviterEmail } = params

  // Re-validate (and normalize) at the domain boundary — the lib never trusts its
  // caller to have validated, and this lowercases/trims the email consistently.
  const parsed = inviteSchema.safeParse({ email: params.email, role: params.role })
  if (!parsed.success) {
    return {
      ok: false,
      error: { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
    }
  }
  const { email, role } = parsed.data

  const supabase = await createClient()

  const members = await fetchMembers(supabase, workspaceId)
  if (members === null) {
    return { ok: false, error: { error: "Could not send the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const callerRole = members.find((m) => m.userId === invitedBy)?.role
  if (!isOwnerOrAdmin(callerRole)) {
    return { ok: false, error: { error: "Only workspace owners and admins can invite members.", code: "FORBIDDEN" } }
  }

  // Plan member-limit gate. canAddMember fails OPEN on a DB error (see lib/usage.ts).
  if (!(await canAddMember(workspaceId))) {
    return {
      ok: false,
      error: {
        error: "You've reached the member limit for your plan. Upgrade to invite more.",
        code: "LIMIT_EXCEEDED",
        upgradeUrl: UPGRADE_URL,
      },
    }
  }

  // "Already a member?" — invitations store an email but membership is keyed by
  // user_id, so resolve each member's email (bounded by team size) and compare.
  const service = createServiceClient()
  const memberAccounts = await Promise.all(
    members.map((m) => service.auth.admin.getUserById(m.userId)),
  )
  const alreadyMember = memberAccounts.some(
    (account) => account.data?.user?.email?.toLowerCase() === email,
  )
  if (alreadyMember) {
    return { ok: false, error: { error: "That person is already a member of this workspace.", code: "VALIDATION_ERROR" } }
  }

  const inviterName = await resolveInviterName(supabase, invitedBy, inviterEmail)

  // The partial-unique index (workspace_id, email WHERE accepted_at IS NULL) enforces
  // one pending invite per email — let the DB reject duplicates rather than racing a
  // pre-check. `token` is generated by the column default and read back for the link.
  const { data, error } = await supabase
    .from("invitations")
    .insert({ workspace_id: workspaceId, email, role, invited_by: invitedBy })
    .select("id, email, role, token, expires_at, created_at")
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: { error: "There's already a pending invitation for that email.", code: "VALIDATION_ERROR" } }
    }
    console.error("[invitations.inviteMember] insert failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not send the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  await sendTeamInvitationEmail({
    to: email,
    inviterName,
    workspaceName,
    acceptUrl: `${SITE_URL}/team/accept?token=${data.token}`,
  })

  await logActivity({
    workspaceId,
    actorId: invitedBy,
    action: "member.invited",
    targetType: "member",
    targetId: data.id,
    metadata: { email, role },
  })

  return {
    ok: true,
    data: {
      id: data.id,
      email: data.email,
      role: data.role as WorkspaceMemberRole,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    },
  }
}

export interface RevokeInvitationParams {
  workspaceId: string
  invitationId: string
  actorId: string
}

export async function revokeInvitation(
  params: RevokeInvitationParams,
): Promise<ApiResult<{ workspaceId: string }>> {
  const { workspaceId, invitationId, actorId } = params
  const supabase = await createClient()

  const members = await fetchMembers(supabase, workspaceId)
  if (members === null) {
    return { ok: false, error: { error: "Could not revoke the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const actorRole = members.find((m) => m.userId === actorId)?.role
  if (!isOwnerOrAdmin(actorRole)) {
    return { ok: false, error: { error: "Only workspace owners and admins can revoke invitations.", code: "FORBIDDEN" } }
  }

  const { data: invitation, error: lookupError } = await supabase
    .from("invitations")
    .select("id, workspace_id, accepted_at")
    .eq("id", invitationId)
    .maybeSingle()

  if (lookupError) {
    console.error("[invitations.revokeInvitation] lookup failed", lookupError)
    Sentry.captureException(lookupError)
    return { ok: false, error: { error: "Could not revoke the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  if (!invitation || invitation.workspace_id !== workspaceId || invitation.accepted_at) {
    return { ok: false, error: { error: "Pending invitation not found.", code: "NOT_FOUND" } }
  }

  const { error } = await supabase.from("invitations").delete().eq("id", invitationId)

  if (error) {
    console.error("[invitations.revokeInvitation] delete failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not revoke the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  return { ok: true, data: { workspaceId } }
}
