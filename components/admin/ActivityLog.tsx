"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import RecentActivity from "@/components/admin/RecentActivity"
import { FILTERABLE_ACTIONS, humanizeAction } from "@/lib/admin-format"
import type { AdminActivityList } from "@/lib/admin-activity"

export default function ActivityLog() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const [data, setData] = useState<AdminActivityList | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let active = true
    setData(null)
    setErrored(false)
    fetch(`/api/admin/activity?${queryString}`)
      .then((response) => {
        if (!response.ok) throw new Error("failed")
        return response.json()
      })
      .then((body: AdminActivityList) => {
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
    router.push(`/admin/activity?${params.toString()}`)
  }

  const page = data?.page ?? 1
  const pageSize = data?.pageSize ?? 20
  // The list endpoint doesn't return a total; a full page implies there may be more.
  const hasNext = (data?.activities.length ?? 0) === pageSize

  return (
    <div className="space-y-4">
      <select
        aria-label="Filter by action"
        className="h-9 min-h-9 w-full rounded-md px-2.5 text-sm sm:w-auto"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
        value={searchParams.get("action") ?? ""}
        onChange={(event) => pushQuery({ action: event.target.value })}
      >
        <option value="">All actions</option>
        {FILTERABLE_ACTIONS.map((action) => (
          <option key={action} value={action}>{humanizeAction(action)}</option>
        ))}
      </select>

      {errored ? (
        <p role="alert" className="rounded-xl p-4 text-sm" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          Could not load the activity log. Refresh the page to try again.
        </p>
      ) : data === null ? (
        <div data-testid="activity-skeleton" className="space-y-3 rounded-xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : data.activities.length === 0 ? (
        <p
          className="rounded-xl p-8 text-center text-sm"
          style={{ border: "1px dashed var(--border-default)", color: "var(--text-secondary)" }}
        >
          No activity in this range.
        </p>
      ) : (
        <RecentActivity activities={data.activities} title="Activity log" />
      )}

      {data && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="min-h-9" disabled={page <= 1} onClick={() => pushQuery({ page: String(page - 1) })}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="min-h-9" disabled={!hasNext} onClick={() => pushQuery({ page: String(page + 1) })}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
