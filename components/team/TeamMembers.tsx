"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import MemberTable from "@/components/team/MemberTable"
import type { EnrichedMember } from "@/lib/team"

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; members: EnrichedMember[]; currentUserId: string }

// Member rows need profile + email enrichment that RLS won't expose to a teammate,
// so they come from the service-role GET /api/team/members route rather than being
// server-rendered. A skeleton covers the fetch (never an empty flash — design.md).
export default function TeamMembers() {
  const [state, setState] = useState<State>({ status: "loading" })

  useEffect(() => {
    let active = true
    fetch("/api/team/members")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed")
        return response.json()
      })
      .then((data) => {
        if (active) setState({ status: "ready", members: data.members, currentUserId: data.currentUserId })
      })
      .catch(() => {
        if (active) setState({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [])

  if (state.status === "loading") {
    return (
      <div
        data-testid="member-skeleton"
        className="rounded-xl p-4 space-y-4"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
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
        Could not load members. Refresh the page to try again.
      </p>
    )
  }

  return <MemberTable members={state.members} currentUserId={state.currentUserId} />
}
