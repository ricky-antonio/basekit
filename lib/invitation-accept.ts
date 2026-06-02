import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { incrementUsage } from "@/lib/usage"
import { logActivity } from "@/lib/activity"
import { PLANS } from "@/lib/plans"
import type { ApiResult, PlanName, WorkspaceMemberRole } from "@/lib/types"

// The invitee-side of the invitation flow: the public token preview and the accept
// action. Both run as the service role (the accepting/previewing user is not yet a
// member, so RLS blocks the reads/writes), which is why this lives apart from the
// owner-side invite/list/revoke flows in lib/invitations.ts.

// Mirrors lib/billing.ts → getActivePlan. Duplicated (not imported) because the
// accept path runs as the service role and the not-yet-member can't read
// subscriptions under RLS, so getActivePlan (RLS-scoped) would collapse to free.
const ACCESS_GRANTING_STATUSES = new Set(["active", "trialing", "past_due"])

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
    console.error("[invitation-accept.getInvitationByToken] lookup failed", error)
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
    console.error("[invitation-accept.memberLimitReached] subscription read failed", subError)
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
    console.error("[invitation-accept.memberLimitReached] usage read failed", usageError)
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
    console.error("[invitation-accept.acceptInvitation] lookup failed", error)
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
      console.error("[invitation-accept.acceptInvitation] member insert failed", insertError)
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
    console.error("[invitation-accept.acceptInvitation] accepted_at update failed", updateError)
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
