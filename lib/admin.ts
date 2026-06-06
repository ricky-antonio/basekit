import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { mapActivityRow } from "@/lib/admin-activity"
import type { AdminActivityRow, RawActivityRow } from "@/lib/admin-activity"
import type { AuthUser } from "@/lib/auth"
import type { ApiResult, PlanName, SubscriptionStatus, UserRole } from "@/lib/types"

// Admin reads cross every tenant, so the whole module runs as the service role and
// MUST only be called from a route handler / Server Action already gated by
// requireAdmin() — never from a Server Component.

const PAGE_SIZE = 20

export interface AdminUserRow {
  userId: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  role: UserRole
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  planName: PlanName
  status: SubscriptionStatus
  stripeCustomerId: string | null
  createdAt: string
}

export interface AdminUserList {
  users: AdminUserRow[]
  total: number
  page: number
  pageSize: number
}

export interface AdminUserDetail {
  userId: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  role: UserRole
  workspace: { id: string; name: string; slug: string; createdAt: string } | null
  subscription: {
    planName: PlanName
    status: SubscriptionStatus
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    stripeCustomerId: string | null
  } | null
  recentActivity: AdminActivityRow[]
}

function normalizePlan(value: string): PlanName {
  return value === "pro" || value === "enterprise" ? value : "free"
}

interface ResolvedAccount {
  email: string | null
  metaName: string | null
}

// Emails live in auth.users (unreadable via the data API), so they're resolved one
// user at a time through the admin API — mirroring lib/team.listTeamMembers. Each
// lookup is isolated so one thrown admin error degrades to "no email" for that user
// rather than failing the whole list.
async function resolveAccount(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<ResolvedAccount> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const metadata = data?.user?.user_metadata as { display_name?: string } | undefined
    return { email: data?.user?.email ?? null, metaName: metadata?.display_name ?? null }
  } catch (error) {
    console.error("[admin.resolveAccount] getUserById failed", error)
    Sentry.captureException(error)
    return { email: null, metaName: null }
  }
}

export interface ListUsersInput {
  search?: string
  plan?: PlanName
  status?: SubscriptionStatus
  page?: number
}

// One subscription row exists per workspace and every user owns exactly one workspace
// in v1, so the subscription set is the user set. plan/status filter at the DB; search
// (email + name + workspace name) needs the enriched identity, so it — and pagination —
// run in memory. Acceptable at v1 admin scale; a searchable identity column is a v2 concern.
export async function listUsers(input: ListUsersInput = {}): Promise<ApiResult<AdminUserList>> {
  const supabase = createServiceClient()
  const page = input.page && input.page > 0 ? input.page : 1

  let query = supabase
    .from("subscriptions")
    .select("workspace_id, plan_name, status, created_at, stripe_customer_id")
  if (input.plan) query = query.eq("plan_name", input.plan)
  if (input.status) query = query.eq("status", input.status)

  const { data: subs, error } = await query.order("created_at", { ascending: false })
  if (error) {
    console.error("[admin.listUsers] subscriptions read failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load users. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const subscriptions = subs ?? []
  if (subscriptions.length === 0) {
    return { ok: true, data: { users: [], total: 0, page, pageSize: PAGE_SIZE } }
  }

  const workspaceIds = subscriptions.map((s) => s.workspace_id)
  const { data: workspaceRows } = await supabase
    .from("workspaces")
    .select("id, name, slug, owner_id, created_at")
    .in("id", workspaceIds)

  const workspaceById = new Map((workspaceRows ?? []).map((w) => [w.id, w]))
  const ownerIds = (workspaceRows ?? []).map((w) => w.owner_id)

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", ownerIds)
  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

  const accountEntries = await Promise.all(
    ownerIds.map(async (id) => [id, await resolveAccount(supabase, id)] as const),
  )
  const accountById = new Map(accountEntries)

  const allRows: AdminUserRow[] = []
  for (const sub of subscriptions) {
    const workspace = workspaceById.get(sub.workspace_id)
    if (!workspace) continue
    const profile = profileById.get(workspace.owner_id)
    const account = accountById.get(workspace.owner_id)
    const email = account?.email ?? null
    allRows.push({
      userId: workspace.owner_id,
      email,
      displayName: profile?.display_name ?? account?.metaName ?? email ?? "User",
      avatarUrl: profile?.avatar_url ?? null,
      role: (profile?.role as UserRole | undefined) ?? "user",
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      planName: normalizePlan(sub.plan_name),
      status: sub.status as SubscriptionStatus,
      stripeCustomerId: sub.stripe_customer_id,
      createdAt: sub.created_at,
    })
  }

  const search = input.search?.trim().toLowerCase()
  const filtered = search
    ? allRows.filter(
        (row) =>
          (row.email?.toLowerCase().includes(search) ?? false) ||
          row.displayName.toLowerCase().includes(search) ||
          row.workspaceName.toLowerCase().includes(search),
      )
    : allRows

  const start = (page - 1) * PAGE_SIZE
  return {
    ok: true,
    data: {
      users: filtered.slice(start, start + PAGE_SIZE),
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
    },
  }
}

export async function getUserDetail(userId: string): Promise<ApiResult<AdminUserDetail>> {
  const supabase = createServiceClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[admin.getUserDetail] profile read failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load the user. Please try again.", code: "INTERNAL_ERROR" } }
  }
  if (!profile) {
    return { ok: false, error: { error: "User not found.", code: "NOT_FOUND" } }
  }

  const account = await resolveAccount(supabase, userId)

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  let subscription: AdminUserDetail["subscription"] = null
  let recentActivity: AdminActivityRow[] = []

  if (workspace) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_name, status, cancel_at_period_end, current_period_end, stripe_customer_id")
      .eq("workspace_id", workspace.id)
      .maybeSingle()

    if (sub) {
      subscription = {
        planName: normalizePlan(sub.plan_name),
        status: sub.status as SubscriptionStatus,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: sub.current_period_end,
        stripeCustomerId: sub.stripe_customer_id,
      }
    }

    const { data: activity } = await supabase
      .from("activity_log")
      .select("id, workspace_id, actor_id, impersonator_id, action, target_type, target_id, metadata, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20)

    recentActivity = ((activity as RawActivityRow[] | null) ?? []).map(mapActivityRow)
  }

  return {
    ok: true,
    data: {
      userId,
      email: account.email,
      displayName: profile.display_name ?? account.metaName ?? account.email ?? "User",
      avatarUrl: profile.avatar_url,
      role: (profile.role as UserRole | undefined) ?? "user",
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug, createdAt: workspace.created_at }
        : null,
      subscription,
      recentActivity,
    },
  }
}

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
    console.error("[admin.overrideUserPlan] workspace read failed", workspaceError)
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
    console.error("[admin.overrideUserPlan] update failed", updateError)
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
