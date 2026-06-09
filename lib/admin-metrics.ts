import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { getDemoWorkspaceIds } from "@/lib/admin-shared"
import type { ApiResult, PlanName } from "@/lib/types"

// All metrics derive from the subscriptions table alone: every user owns exactly one
// workspace (v1), and bootstrap_workspace creates one subscription row per workspace,
// so the subscription set IS the user set. One read, everything computed in memory.

// Per-month price for each plan, normalising annual to a monthly figure ($276/yr → $23,
// $948/yr → $79). Source of truth for plan prices is Stripe; mirrored here only for MRR.
const PRO_MONTHLY = 29
const PRO_ANNUAL_PER_MONTH = 23
const ENTERPRISE_MONTHLY = 99
const ENTERPRISE_ANNUAL_PER_MONTH = 79

// Statuses that count toward live revenue. past_due is included (Stripe is still in
// dunning, access is still granted); canceled/incomplete/unpaid are not.
const REVENUE_STATUSES = new Set(["active", "trialing", "past_due"])

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface MrrTrendPoint {
  month: string
  mrr: number
}

export interface AdminMetrics {
  mrr: number
  arr: number
  totalUsers: number
  activeSubscribers: number
  planCounts: Record<PlanName, number>
  churnRate30d: number
  trialConversionRate: number
  mrrTrend12m: MrrTrendPoint[]
}

interface RawSubscription {
  plan_name: string
  status: string
  stripe_price_id: string | null
  trial_end: string | null
  created_at: string
  updated_at: string
}

function normalizePlan(value: string): PlanName {
  return value === "pro" || value === "enterprise" ? value : "free"
}

function monthlyAmount(priceId: string | null, plan: PlanName): number {
  if (priceId) {
    if (priceId === process.env["STRIPE_PRICE_PRO_MONTHLY"]) return PRO_MONTHLY
    if (priceId === process.env["STRIPE_PRICE_PRO_ANNUAL"]) return PRO_ANNUAL_PER_MONTH
    if (priceId === process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"]) return ENTERPRISE_MONTHLY
    if (priceId === process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"]) return ENTERPRISE_ANNUAL_PER_MONTH
  }
  // Comped / admin-overridden plans carry no Stripe price — fall back to the monthly rate.
  if (plan === "pro") return PRO_MONTHLY
  if (plan === "enterprise") return ENTERPRISE_MONTHLY
  return 0
}

function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

// 12 trailing monthly buckets, oldest first. A paid subscription contributes to a
// bucket if it existed by the end of that month and was still granting access then
// (either it grants access now, or it canceled after that month's end).
function buildTrend(subs: RawSubscription[], now: Date): MrrTrendPoint[] {
  const points: MrrTrendPoint[] = []
  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const bucketStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1))
    const bucketEnd = new Date(
      Date.UTC(bucketStart.getUTCFullYear(), bucketStart.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    )
    let bucketMrr = 0
    for (const sub of subs) {
      const plan = normalizePlan(sub.plan_name)
      if (plan === "free") continue
      if (new Date(sub.created_at).getTime() > bucketEnd.getTime()) continue
      const grantsNow = REVENUE_STATUSES.has(sub.status)
      const canceledAfterBucket =
        sub.status === "canceled" && new Date(sub.updated_at).getTime() > bucketEnd.getTime()
      if (grantsNow || canceledAfterBucket) {
        bucketMrr += monthlyAmount(sub.stripe_price_id, plan)
      }
    }
    points.push({ month: monthLabel(bucketStart), mrr: bucketMrr })
  }
  return points
}

export async function getMetrics(demoOnly = false): Promise<ApiResult<AdminMetrics>> {
  const supabase = createServiceClient()

  let query = supabase
    .from("subscriptions")
    .select("plan_name, status, stripe_price_id, trial_end, created_at, updated_at")
  // Demo scoping: only subscriptions belonging to demo-* workspaces feed the metrics.
  if (demoOnly) query = query.in("workspace_id", await getDemoWorkspaceIds(supabase))

  const { data, error } = await query

  if (error) {
    console.error("[admin-metrics.getMetrics] read failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load metrics. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const subs = (data ?? []) as RawSubscription[]
  const now = new Date()

  let mrr = 0
  let activeSubscribers = 0
  const planCounts: Record<PlanName, number> = { free: 0, pro: 0, enterprise: 0 }

  for (const sub of subs) {
    const plan = normalizePlan(sub.plan_name)
    planCounts[plan] += 1
    if (plan !== "free" && REVENUE_STATUSES.has(sub.status)) {
      activeSubscribers += 1
      mrr += monthlyAmount(sub.stripe_price_id, plan)
    }
  }

  const periodStart = now.getTime() - THIRTY_DAYS_MS
  const canceledLast30d = subs.filter(
    (s) => s.status === "canceled" && new Date(s.updated_at).getTime() >= periodStart,
  ).length
  // Subscribers active at the period start = those still paying + those who churned out.
  const activeAtStart = activeSubscribers + canceledLast30d
  const churnRate30d = activeAtStart === 0 ? 0 : canceledLast30d / activeAtStart

  const trials = subs.filter((s) => s.trial_end !== null)
  const converted = trials.filter((s) => s.status === "active").length
  const trialConversionRate = trials.length === 0 ? 0 : converted / trials.length

  return {
    ok: true,
    data: {
      mrr,
      arr: mrr * 12,
      totalUsers: subs.length,
      activeSubscribers,
      planCounts,
      churnRate30d,
      trialConversionRate,
      mrrTrend12m: buildTrend(subs, now),
    },
  }
}
