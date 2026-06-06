import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { normalizePlan, resolveAccount } from "@/lib/admin-shared"
import type { AuthUser } from "@/lib/auth"
import type { ApiResult, PlanName } from "@/lib/types"

// Admin plan override (a write), separated from the admin reads in lib/admin.ts. Runs as
// the service role and MUST only be called from a requireAdmin()-gated route handler.

export interface OverrideUserPlanParams {
  admin: AuthUser
  userId: string
  plan: PlanName
  reason: string
}

// Manually sets a workspace's plan, bypassing Stripe. The status is forced to a
// access-granting value so getActivePlan honours the override immediately. If a live
// Stripe subscription exists, the next webhook reconciles it — admin override is meant
// for comped / manual plans, not for editing a self-serve subscriber's billing.
export async function overrideUserPlan(
  params: OverrideUserPlanParams,
): Promise<ApiResult<{ userId: string; plan: PlanName }>> {
  const { admin, userId, plan, reason } = params

  if (admin.role !== "admin") {
    return { ok: false, error: { error: "You do not have permission to override plans.", code: "FORBIDDEN" } }
  }

  const supabase = createServiceClient()

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (workspaceError) {
    console.error("[admin-override.overrideUserPlan] workspace read failed", workspaceError)
    Sentry.captureException(workspaceError)
    return { ok: false, error: { error: "Could not override the plan. Please try again.", code: "INTERNAL_ERROR" } }
  }
  if (!workspace) {
    return { ok: false, error: { error: "No workspace found for this user.", code: "NOT_FOUND" } }
  }

  const { data: current } = await supabase
    .from("subscriptions")
    .select("plan_name")
    .eq("workspace_id", workspace.id)
    .maybeSingle()
  const fromPlan = current ? normalizePlan(current.plan_name) : "free"

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({ plan_name: plan, status: "active", cancel_at_period_end: false })
    .eq("workspace_id", workspace.id)

  if (updateError) {
    console.error("[admin-override.overrideUserPlan] update failed", updateError)
    Sentry.captureException(updateError)
    return { ok: false, error: { error: "Could not override the plan. Please try again.", code: "INTERNAL_ERROR" } }
  }

  // Record who the override was applied to so the audit feed reads "<user>: free → pro"
  // without a per-row identity lookup (mirrors member.invited carrying the invited email).
  const target = await resolveAccount(supabase, userId)

  await logActivity({
    workspaceId: workspace.id,
    actorId: admin.id,
    action: "admin.plan_override",
    targetType: "subscription",
    targetId: workspace.id,
    metadata: {
      from: fromPlan,
      to: plan,
      reason,
      targetUserId: userId,
      targetEmail: target.email,
      targetName: target.metaName,
    },
  })

  return { ok: true, data: { userId, plan } }
}
