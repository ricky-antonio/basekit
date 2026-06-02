import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { canAddMember, incrementUsage } from "@/lib/usage"
import { sendTeamInvitationEmail } from "@/lib/email"
import { logActivity } from "@/lib/activity"
import { inviteSchema } from "@/lib/validation/team"
import { zodFieldErrors } from "@/lib/validation/errors"
import { fetchMembers, isOwnerOrAdmin, type ServerClient } from "@/lib/team"
import { PLANS } from "@/lib/plans"
import type { ApiResult, PlanName, WorkspaceMemberRole } from "@/lib/types"

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"
const UPGRADE_URL = "/settings/billing"

// Mirrors lib/billing.ts → getActivePlan. Duplicated (not imported) because the
// accept path runs as the service role and the not-yet-member can't read
// subscriptions under RLS, so getActivePlan (RLS-scoped) would collapse to free.
const ACCESS_GRANTING_STATUSES = new Set(["active", "trialing", "past_due"])

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

export type InvitationPreviewStatus = "valid" | "expired" | "accepted" | "not_found"

export interface InvitationPreview {
  status: InvitationPreviewStatus
  workspaceName: string | null
  inviterName: string | null
  email: string | null
  role: WorkspaceMemberRole | null
}

// Display-only lookup for the public /team/accept page. The token IS the secret, so
// a holder may see who invited them and to which workspace — but neither the workspace
// name (workspaces_select_members) nor a cross-member profile is readable under RLS by
// a non-member, so this runs as the service role. Returns a status discriminant rather
// than ApiResult: the page renders all four states, none of which is an "error".
export async function getInvitationByToken(token: string): Promise<InvitationPreview> {
  const notFound: InvitationPreview = {
    status: "not_found",
    workspaceName: null,
    inviterName: null,
    email: null,
    role: null,
  }
  const supabase = createServiceClient()

  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("workspace_id, email, role, invited_by, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle()

  if (error) {
    console.error("[invitations.getInvitationByToken] lookup failed", error)
    Sentry.captureException(error)
    return notFound
  }
  if (!invitation) return notFound

  const email = invitation.email
  const role = invitation.role as WorkspaceMemberRole

  if (invitation.accepted_at) {
    return { status: "accepted", workspaceName: null, inviterName: null, email, role }
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { status: "expired", workspaceName: null, inviterName: null, email, role }
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", invitation.workspace_id)
    .maybeSingle()

  let inviterName: string | null = null
  if (invitation.invited_by) {
    const { data: inviter } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", invitation.invited_by)
      .maybeSingle()
    inviterName = inviter?.display_name ?? null
  }

  return { status: "valid", workspaceName: workspace?.name ?? null, inviterName, email, role }
}

// Service-role member-limit check for the accept path. Fails OPEN on a read error,
// consistent with lib/usage.ts — the at-invite gate already applied; this is the
// second barrier that closes the multiple-pending-invites overshoot.
async function memberLimitReached(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
): Promise<boolean> {
  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .select("plan_name, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (subError) {
    console.error("[invitations.memberLimitReached] subscription read failed", subError)
    Sentry.captureException(subError)
    return false
  }

  const plan: PlanName =
    sub &&
    ACCESS_GRANTING_STATUSES.has(sub.status) &&
    (sub.plan_name === "pro" || sub.plan_name === "enterprise")
      ? sub.plan_name
      : "free"

  const limit = PLANS[plan].memberLimit
  if (limit === null) return false

  const { data: usage, error: usageError } = await supabase
    .from("usage")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("resource", "members")
    .maybeSingle()

  if (usageError) {
    console.error("[invitations.memberLimitReached] usage read failed", usageError)
    Sentry.captureException(usageError)
    return false
  }

  return (usage?.count ?? 0) >= limit
}

export interface AcceptInvitationParams {
  token: string
  userId: string
}

export async function acceptInvitation(
  params: AcceptInvitationParams,
): Promise<ApiResult<{ workspaceId: string; role: WorkspaceMemberRole }>> {
  const { token, userId } = params
  // The accepting user is authenticated but not yet a member, so RLS would block both
  // the membership insert and the invitation update — this runs as the service role.
  const supabase = createServiceClient()

  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, workspace_id, role, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle()

  if (error) {
    console.error("[invitations.acceptInvitation] lookup failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not accept the invitation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  if (!invitation) {
    return { ok: false, error: { error: "This invitation is no longer valid.", code: "NOT_FOUND" } }
  }

  if (invitation.accepted_at) {
    return { ok: false, error: { error: "This invitation has already been accepted.", code: "VALIDATION_ERROR" } }
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { ok: false, error: { error: "This invitation has expired.", code: "VALIDATION_ERROR" } }
  }

  const role = invitation.role as WorkspaceMemberRole

  // Idempotent: a replayed accept (membership already exists) marks the invite
  // accepted without double-inserting or double-counting usage.
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invitation.workspace_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (!existing) {
    // Re-gate the plan member-limit here (service role can read usage/subscription
    // even though the not-yet-member can't under RLS). This closes the overshoot
    // where many pending invites each pass the at-invite gate then all accept.
    if (await memberLimitReached(supabase, invitation.workspace_id)) {
      return {
        ok: false,
        error: { error: "This workspace has reached its member limit.", code: "LIMIT_EXCEEDED" },
      }
    }

    const { error: insertError } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: invitation.workspace_id, user_id: userId, role })

    if (insertError) {
      console.error("[invitations.acceptInvitation] member insert failed", insertError)
      Sentry.captureException(insertError)
      return { ok: false, error: { error: "Could not join the workspace. Please try again.", code: "INTERNAL_ERROR" } }
    }

    await incrementUsage(invitation.workspace_id, "members")
  }

  // Best-effort: the membership row is the source of truth. If this fails the invite
  // stays replayable, and the idempotency check above makes that harmless.
  const { error: updateError } = await supabase
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id)

  if (updateError) {
    console.error("[invitations.acceptInvitation] accepted_at update failed", updateError)
    Sentry.captureException(updateError)
  }

  await logActivity({
    workspaceId: invitation.workspace_id,
    actorId: userId,
    action: "member.joined",
    targetType: "member",
    targetId: userId,
    metadata: { role },
  })

  return { ok: true, data: { workspaceId: invitation.workspace_id, role } }
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
