"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import PlanBadge from "@/components/billing/PlanBadge"
import StatusBadge from "@/components/admin/StatusBadge"
import type { AdminUserList } from "@/lib/admin"

const PLAN_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All plans" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
]

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
  { value: "incomplete", label: "Incomplete" },
  { value: "unpaid", label: "Unpaid" },
]

const SELECT_CLASS = "h-9 min-h-9 w-full rounded-md px-2.5 text-sm sm:w-auto"
const SELECT_STYLE: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  color: "var(--text-primary)",
}

function initialsOf(name: string): string {
  return name.split(" ").slice(0, 2).map((word) => word[0] ?? "").join("").toUpperCase()
}

export default function UserTable() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "")
  const [data, setData] = useState<AdminUserList | null>(null)
  const [errored, setErrored] = useState(false)

  // Filters + pagination are URL-driven; pushing a new URL re-runs this fetch.
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

  // Live search: debounce the input into the URL so the table filters as you type and
  // clearing the field resets. Only acts when the trimmed input actually differs from the
  // current URL param, so mount + post-navigation renders don't loop. Uses replace (not
  // push) so type-as-you-go doesn't stack a history entry per keystroke-pause.
  useEffect(() => {
    const current = new URLSearchParams(queryString).get("search") ?? ""
    const next = searchInput.trim()
    if (next === current) return
    const timer = setTimeout(() => {
      const params = new URLSearchParams(queryString)
      if (next) params.set("search", next)
      else params.delete("search")
      params.delete("page")
      router.replace(`/admin/users?${params.toString()}`)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, queryString, router])

  function pushQuery(overrides: Record<string, string>) {
    const params = new URLSearchParams(queryString)
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    // Any filter/search change returns to the first page.
    if (!("page" in overrides)) params.delete("page")
    router.push(`/admin/users?${params.toString()}`)
  }

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    pushQuery({ search: searchInput.trim() })
  }

  const page = data?.page ?? 1
  const pageSize = data?.pageSize ?? 20
  const total = data?.total ?? 0
  const hasPrev = page > 1
  const hasNext = page * pageSize < total

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={onSearchSubmit} className="flex-1" role="search">
          <Input
            type="search"
            aria-label="Search users"
            placeholder="Search by name, email, or workspace"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </form>
        <select
          aria-label="Filter by plan"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={searchParams.get("plan") ?? ""}
          onChange={(event) => pushQuery({ plan: event.target.value })}
        >
          {PLAN_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          value={searchParams.get("status") ?? ""}
          onChange={(event) => pushQuery({ status: event.target.value })}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {errored ? (
        <p
          role="alert"
          className="rounded-xl p-4 text-sm"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
        >
          Could not load users. Refresh the page to try again.
        </p>
      ) : data === null ? (
        <div
          data-testid="user-table-skeleton"
          className="space-y-4 rounded-xl p-4"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
          ))}
        </div>
      ) : data.users.length === 0 ? (
        <p
          className="rounded-xl p-8 text-center text-sm"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
        >
          No users match these filters.
        </p>
      ) : (
        <ul
          data-testid="user-list"
          className="overflow-hidden rounded-xl"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          {data.users.map((user, index) => (
            <li key={user.userId} style={index > 0 ? { borderTop: "1px solid var(--border-default)" } : undefined}>
              <Link
                href={`/admin/users/${user.userId}`}
                data-testid="user-row"
                className="flex min-h-11 flex-col gap-3 p-4 transition-colors hover:bg-[var(--bg-surface-hover)] md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                    <AvatarFallback className="text-xs font-semibold" style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}>
                      {initialsOf(user.displayName) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {user.displayName}
                    </p>
                    {user.email && (
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>{user.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{user.workspaceName}</span>
                  <PlanBadge plan={user.planName} />
                  <StatusBadge status={user.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {data && data.users.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {total} {total === 1 ? "user" : "users"} · page {page}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="min-h-9" disabled={!hasPrev} onClick={() => pushQuery({ page: String(page - 1) })}>
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
