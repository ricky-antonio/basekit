import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getActivePlan } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import type { ApiResult, UsageResource } from "@/lib/types"

// Current usage count for a resource. Returns 0 when no counter row exists yet.
export async function getUsage(
  workspaceId: string,
  resource: UsageResource,
): Promise<ApiResult<number>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("usage")
    .select("count")
    .eq("workspace_id", workspaceId)
    .eq("resource", resource)
    .maybeSingle()

  if (error) {
    return { ok: false, error: { error: "Could not read usage.", code: "INTERNAL_ERROR" } }
  }

  return { ok: true, data: data?.count ?? 0 }
}

// Limit checks fail OPEN: if we cannot determine the plan or the count, we let the
// action through and record the failure in Sentry. Blocking a paying user because
// of a transient DB error is worse than briefly allowing one extra resource.
async function isUnderLimit(
  workspaceId: string,
  resource: UsageResource,
  limit: number | null,
): Promise<boolean> {
  if (limit === null) return true
  try {
    const usage = await getUsage(workspaceId, resource)
    if (!usage.ok) throw new Error(usage.error.error)
    return usage.data < limit
  } catch (error) {
    console.error(`[usage] limit check for ${resource} failed`, error)
    Sentry.captureException(error)
    return true
  }
}

export async function canCreateProject(workspaceId: string): Promise<boolean> {
  try {
    const plan = await getActivePlan(workspaceId)
    return isUnderLimit(workspaceId, "projects", PLANS[plan].projectLimit)
  } catch (error) {
    console.error("[usage] canCreateProject failed", error)
    Sentry.captureException(error)
    return true
  }
}

export async function canAddMember(workspaceId: string): Promise<boolean> {
  try {
    const plan = await getActivePlan(workspaceId)
    return isUnderLimit(workspaceId, "members", PLANS[plan].memberLimit)
  } catch (error) {
    console.error("[usage] canAddMember failed", error)
    Sentry.captureException(error)
    return true
  }
}

// Counter mutations go through the atomic RPCs (race-safe under concurrent writes).
// Best-effort: the resource row itself is the source of truth, so a counter drift
// is logged to Sentry rather than failing the user's action.
export async function incrementUsage(
  workspaceId: string,
  resource: UsageResource,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc("increment_usage", {
    p_workspace_id: workspaceId,
    p_resource: resource,
  })
  if (error) {
    console.error("[usage] increment_usage failed", error)
    Sentry.captureException(error)
  }
}

export async function decrementUsage(
  workspaceId: string,
  resource: UsageResource,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc("decrement_usage", {
    p_workspace_id: workspaceId,
    p_resource: resource,
  })
  if (error) {
    console.error("[usage] decrement_usage failed", error)
    Sentry.captureException(error)
  }
}
