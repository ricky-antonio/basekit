import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { getMetrics } from "@/lib/admin-metrics"

interface Sub {
  plan_name: string
  status: string
  stripe_price_id: string | null
  trial_end: string | null
  created_at: string
  updated_at: string
}

function sub(overrides: Partial<Sub>): Sub {
  return {
    plan_name: "free",
    status: "active",
    stripe_price_id: null,
    trial_end: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  }
}

const PRO_MONTHLY = "price_pro_monthly_test"
const PRO_ANNUAL = "price_pro_annual_test"

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-04T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getMetrics", () => {
  it("returns 0 MRR when no paid subscriptions", async () => {
    mockSupabaseFrom("subscriptions", { data: [sub({}), sub({})], error: null })
    const result = await getMetrics()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.mrr).toBe(0)
    expect(result.data.arr).toBe(0)
    expect(result.data.activeSubscribers).toBe(0)
    expect(result.data.totalUsers).toBe(2)
    expect(result.data.churnRate30d).toBe(0)
  })

  it("MRR includes pro_monthly * 29 and pro_annual * 23 (per-month normalised)", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY }),
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_ANNUAL }),
      ],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.mrr).toBe(52)
    expect(result.data.arr).toBe(624)
    expect(result.data.activeSubscribers).toBe(2)
  })

  it("MRR excludes canceled subscriptions", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [sub({ plan_name: "pro", status: "canceled", stripe_price_id: PRO_MONTHLY, updated_at: "2026-05-20T00:00:00Z" })],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok && result.data.mrr).toBe(0)
    expect(result.ok && result.data.activeSubscribers).toBe(0)
  })

  it("MRR includes trialing subscriptions", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [sub({ plan_name: "pro", status: "trialing", stripe_price_id: PRO_MONTHLY })],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok && result.data.mrr).toBe(29)
  })

  it("plan breakdown counts each plan correctly", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [
        sub({ plan_name: "free" }),
        sub({ plan_name: "pro", stripe_price_id: PRO_MONTHLY }),
        sub({ plan_name: "pro", stripe_price_id: PRO_ANNUAL }),
        sub({ plan_name: "enterprise" }),
      ],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.planCounts).toEqual({ free: 1, pro: 2, enterprise: 1 })
  })

  it("churnRate30d = canceled in last 30 days / active at start of period", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY }),
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY }),
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY }),
        sub({ plan_name: "pro", status: "canceled", stripe_price_id: PRO_MONTHLY, updated_at: "2026-05-20T00:00:00Z" }),
        // canceled long ago — outside the 30-day window, so it must not count.
        sub({ plan_name: "pro", status: "canceled", stripe_price_id: PRO_MONTHLY, updated_at: "2026-01-01T00:00:00Z" }),
      ],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 1 churned / (3 active + 1 churned) = 0.25
    expect(result.data.churnRate30d).toBeCloseTo(0.25)
  })

  it("trialConversionRate = converted trials / all trials", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [
        sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY, trial_end: "2026-05-01T00:00:00Z" }),
        sub({ plan_name: "pro", status: "canceled", stripe_price_id: PRO_MONTHLY, trial_end: "2026-05-01T00:00:00Z", updated_at: "2026-05-10T00:00:00Z" }),
      ],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok && result.data.trialConversionRate).toBeCloseTo(0.5)
  })

  it("mrrTrend12m returns 12 entries oldest-first", async () => {
    mockSupabaseFrom("subscriptions", {
      data: [sub({ plan_name: "pro", status: "active", stripe_price_id: PRO_MONTHLY, created_at: "2025-01-01T00:00:00Z" })],
      error: null,
    })
    const result = await getMetrics()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const trend = result.data.mrrTrend12m
    expect(trend).toHaveLength(12)
    expect(trend[0]?.month).toBe("2025-07")
    expect(trend[11]?.month).toBe("2026-06")
    // oldest-first ordering
    expect(trend[0]!.month < trend[11]!.month).toBe(true)
    // a continuously-active sub contributes to every bucket
    expect(trend[11]?.mrr).toBe(29)
  })

  it("returns INTERNAL_ERROR when the read fails", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: { message: "boom" } })
    const result = await getMetrics()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
