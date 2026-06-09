import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { mapActivityRow } from "@/lib/admin-activity"
import { normalizePlan, resolveAccount, DEMO_WORKSPACE_PREFIX } from "@/lib/admin-shared"
import type { AdminActivityRow, RawActivityRow } from "@/lib/admin-activity"
import type { ApiResult, PlanName, SubscriptionStatus, UserRole } from "@/lib/types"

// The plan override (a write) lives in lib/admin-override.ts; re-exported here so the admin
// domain has one import surface.
export { overrideUserPlan } from "@/lib/admin-override"
export type { OverrideUserPlanParams } from "@/lib/admin-override"

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

export interface ListUsersInput {
  search?: string
  plan?: PlanName
  status?: SubscriptionStatus
  page?: number
  // When set (the public demo admin), restrict the listing to demo workspaces only.
  demoOnly?: boolean
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
  let workspaceQuery = supabase
    .from("workspaces")
    .select("id, name, slug, owner_id, created_at")
    .in("id", workspaceIds)
  // Demo scoping: only demo-* workspaces survive, so real tenants' subs fall out of the
  // row loop below (no workspace match → skipped), and search/total see demo data only.
  if (input.demoOnly) workspaceQuery = workspaceQuery.like("slug", `${DEMO_WORKSPACE_PREFIX}%`)
  const { data: workspaceRows } = await workspaceQuery

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

export async function getUserDetail(
  userId: string,
  demoOnly = false,
): Promise<ApiResult<AdminUserDetail>> {
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

  // Demo admin can't drill into a real tenant by guessing a URL — treat non-demo as absent.
  if (demoOnly && (!workspace || !workspace.slug.startsWith(DEMO_WORKSPACE_PREFIX))) {
    return { ok: false, error: { error: "User not found.", code: "NOT_FOUND" } }
  }

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
