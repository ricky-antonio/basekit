"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Skeleton } from "@/components/ui/skeleton"
import UserDetailHeader from "@/components/admin/UserDetailHeader"
import PlanOverrideDialog from "@/components/admin/PlanOverrideDialog"
import RecentActivity from "@/components/admin/RecentActivity"
import type { AdminUserDetail } from "@/lib/admin"
import type { ApiError, PlanName } from "@/lib/types"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

const STRIPE_BASE = "https://dashboard.stripe.com/customers"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; detail: AdminUserDetail }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-right" style={{ color: "var(--text-primary)" }}>{children}</span>
    </div>
  )
}

export default function UserDetail({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ status: "loading" })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      if (!response.ok) throw new Error("failed")
      const detail: AdminUserDetail = await response.json()
      setState({ status: "ready", detail })
    } catch {
      setState({ status: "error" })
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleOverride(plan: PlanName, reason: string) {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, reason }),
      })
      if (response.ok) {
        toast.success(`Plan set to ${plan}.`)
        setDialogOpen(false)
        await load()
        return
      }
      const error: ApiError = await response
        .json()
        .catch(() => ({ error: "Could not override the plan. Please try again.", code: "INTERNAL_ERROR" as const }))
      toast.error(error.error)
    } catch {
      toast.error("Could not override the plan. Please try again.")
    }
  }

  async function handleImpersonate() {
    setImpersonating(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" })
      if (response.ok) {
        // Full reload so every server layout re-resolves as the impersonated user.
        window.location.href = "/dashboard"
        return
      }
      const error: ApiError = await response
        .json()
        .catch(() => ({ error: "Could not start impersonation. Please try again.", code: "INTERNAL_ERROR" as const }))
      toast.error(error.error)
      setImpersonating(false)
    } catch {
      toast.error("Could not start impersonation. Please try again.")
      setImpersonating(false)
    }
  }

  if (state.status === "loading") {
    return (
      <div data-testid="user-detail-skeleton" className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-xl p-4 text-sm"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
      >
        Could not load this user. Refresh the page to try again.
      </p>
    )
  }

  const { detail } = state
  const subscription = detail.subscription

  return (
    <div className="space-y-6">
      <UserDetailHeader
        detail={detail}
        onOverride={() => setDialogOpen(true)}
        onImpersonate={handleImpersonate}
        impersonating={impersonating}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section
          className="rounded-xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>Subscription</h2>
          {subscription ? (
            <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
              <Row label="Plan">{subscription.planName}</Row>
              <Row label="Status">{subscription.status}</Row>
              <Row label="Renews">{formatDate(subscription.currentPeriodEnd)}</Row>
              <Row label="Cancels at period end">{subscription.cancelAtPeriodEnd ? "Yes" : "No"}</Row>
              <Row label="Stripe customer">
                {subscription.stripeCustomerId ? (
                  <a
                    href={`${STRIPE_BASE}/${subscription.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs underline"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    {subscription.stripeCustomerId}
                  </a>
                ) : (
                  "—"
                )}
              </Row>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No subscription on record.</p>
          )}
        </section>

        <section
          className="rounded-xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>Workspace</h2>
          {detail.workspace ? (
            <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
              <Row label="Name">{detail.workspace.name}</Row>
              <Row label="Slug">
                <span className="font-mono text-xs">{detail.workspace.slug}</span>
              </Row>
              <Row label="Created">{formatDate(detail.workspace.createdAt)}</Row>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No workspace on record.</p>
          )}
        </section>
      </div>

      <RecentActivity activities={detail.recentActivity} title="Recent activity" />

      <PlanOverrideDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentPlan={subscription?.planName ?? "free"}
        onConfirm={handleOverride}
      />
    </div>
  )
}
