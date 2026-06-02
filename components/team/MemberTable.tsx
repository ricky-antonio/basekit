"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import RoleBadge from "@/components/team/RoleBadge"
import type { EnrichedMember } from "@/lib/team"
import type { WorkspaceMemberRole } from "@/lib/types"

interface MemberTableProps {
  members: EnrichedMember[]
  currentUserId: string
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

function formatJoined(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function MemberTable({ members, currentUserId }: MemberTableProps) {
  const [rows, setRows] = useState(members)
  const [removeTarget, setRemoveTarget] = useState<EnrichedMember | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const currentUserRole = rows.find((m) => m.userId === currentUserId)?.role
  const canManage = currentUserRole === "owner" || currentUserRole === "admin"

  // You manage other members, never yourself or the (locked) owner.
  function canActOn(member: EnrichedMember): boolean {
    return canManage && member.userId !== currentUserId && member.role !== "owner"
  }

  async function changeRole(member: EnrichedMember, newRole: WorkspaceMemberRole) {
    const snapshot = rows
    setBusyId(member.userId)
    setRows((prev) => prev.map((r) => (r.userId === member.userId ? { ...r, role: newRole } : r)))
    try {
      const response = await fetch("/api/team/role", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberUserId: member.userId, role: newRole }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setRows(snapshot)
        toast.error(body?.error ?? "Could not change the role. Please try again.")
      } else {
        toast.success(`${member.displayName} is now ${newRole === "admin" ? "an admin" : "a member"}.`)
      }
    } catch {
      setRows(snapshot)
      toast.error("Could not change the role. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  async function confirmRemove() {
    const member = removeTarget
    if (!member) return
    const snapshot = rows
    setBusyId(member.userId)
    setRows((prev) => prev.filter((r) => r.userId !== member.userId))
    try {
      const response = await fetch("/api/team/remove", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberUserId: member.userId }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setRows(snapshot)
        toast.error(body?.error ?? "Could not remove the member. Please try again.")
      } else {
        toast.success(`${member.displayName} was removed.`)
      }
    } catch {
      setRows(snapshot)
      toast.error("Could not remove the member. Please try again.")
    } finally {
      setBusyId(null)
      setRemoveTarget(null)
    }
  }

  return (
    <>
      <ul
        data-testid="member-list"
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        {rows.map((member, index) => {
          const isSelf = member.userId === currentUserId
          const nextRole: WorkspaceMemberRole = member.role === "member" ? "admin" : "member"
          return (
            <li
              key={member.userId}
              data-testid="member-row"
              className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
              style={index > 0 ? { borderTop: "1px solid var(--border-default)" } : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.displayName} />}
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
                  >
                    {initialsOf(member.displayName) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {member.displayName}
                    {isSelf && (
                      <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                        (you)
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {member.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4 shrink-0 flex-wrap">
                <RoleBadge role={member.role} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Joined {formatJoined(member.joinedAt)}
                </span>
                {canActOn(member) && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9"
                      disabled={busyId === member.userId}
                      onClick={() => changeRole(member, nextRole)}
                    >
                      {member.role === "member" ? "Make admin" : "Make member"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="min-h-9"
                      aria-label={`Remove ${member.displayName}`}
                      disabled={busyId === member.userId}
                      onClick={() => setRemoveTarget(member)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
        title="Remove member"
        description={
          removeTarget
            ? `Remove ${removeTarget.displayName} from this workspace? They lose access immediately.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemove}
      />
    </>
  )
}
