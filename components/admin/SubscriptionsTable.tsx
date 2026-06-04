"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import PlanBadge from "@/components/billing/PlanBadge"
import StatusBadge from "@/components/admin/StatusBadge"
import type { AdminUserList } from "@/lib/admin"

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
  { value: "incomplete", label: "Incomplete" },
  { value: "unpaid", label: "Unpaid" },
]

const STRIPE_BASE = "https://dashboard.stripe.com/customers"

export default function SubscriptionsTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const [data, setData] = useState<AdminUserList | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let active = true
    setData(null)
    setErrored(false)
    fetch(`/api/admin/users?${queryString}`)
      .then((response) => {
        if (!response.ok) throw new Error("failed")
        return response.json()
      })
      .then((body: AdminUserList) => {
        if (active) setData(body)
      })
      .catch(() => {
        if (active) setErrored(true)
      })
    return () => {
      active = false
    }
  }, [queryString])

  function pushQuery(overrides: Record<string, string>) {
    const params = new URLSearchParams(queryString)
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!("page" in overrides)) params.delete("page")
    router.push(`/admin/subscriptions?${params.toString()}`)
  }

  const page = data?.page ?? 1
  const pageSize = data?.pageSize ?? 20
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <select
        aria-label="Filter by status"
        className="h-9 min-h-9 w-full rounded-md px-2.5 text-sm sm:w-auto"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        value={searchParams.get("status") ?? ""}
        onChange={(event) => pushQuery({ status: event.target.value })}
      >
        {STATUS_FILTERS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {errored ? (
        <p role="alert" className="rounded-xl p-4 text-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          Could not load subscriptions. Refresh the page to try again.
        </p>
      ) : data === null ? (
        <div data-testid="subscriptions-skeleton" className="space-y-3 rounded-xl p-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <p className="rounded-xl p-8 text-center text-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          No subscriptions match this filter.
        </p>
      ) : (
        <ul data-testid="subscription-list" className="overflow-hidden rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          {data.users.map((user, index) => (
            <li
              key={user.workspaceId}
              data-testid="subscription-row"
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              style={index > 0 ? { borderTop: "1px solid var(--border-default)" } : undefined}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user.workspaceName}</p>
                {user.email && <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>{user.email}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <PlanBadge plan={user.planName} />
                <StatusBadge status={user.status} />
                {user.stripeCustomerId ? (
                  <a
                    href={`${STRIPE_BASE}/${user.stripeCustomerId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Stripe ↗
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>No customer</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.users.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {total} {total === 1 ? "subscription" : "subscriptions"} · page {page}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="min-h-9" disabled={page <= 1} onClick={() => pushQuery({ page: String(page - 1) })}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="min-h-9" disabled={page * pageSize >= total} onClick={() => pushQuery({ page: String(page + 1) })}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
