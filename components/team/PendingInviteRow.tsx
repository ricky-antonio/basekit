"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import RoleBadge from "@/components/team/RoleBadge"
import { IconMail } from "@tabler/icons-react"
import type { PendingInvitation } from "@/lib/invitations"

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function PendingInviteRow({ invitation }: { invitation: PendingInvitation }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  async function revoke() {
    setHidden(true)
    try {
      const response = await fetch("/api/team/revoke", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: invitation.id }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setHidden(false)
        toast.error(body?.error ?? "Could not revoke the invitation. Please try again.")
      } else {
        toast.success("Invitation revoked.")
        router.refresh()
      }
    } catch {
      setHidden(false)
      toast.error("Could not revoke the invitation. Please try again.")
    } finally {
      setConfirmOpen(false)
    }
  }

  if (hidden) return null

  return (
    <li
      data-testid="pending-invite-row"
      className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-center gap-3 min-w-0">
        <IconMail size={18} aria-hidden="true" style={{ color: "var(--text-muted)" }} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {invitation.email}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Invited {formatDate(invitation.createdAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <RoleBadge role={invitation.role} />
        <Button
          variant="ghost"
          size="sm"
          className="min-h-9"
          aria-label={`Revoke invitation for ${invitation.email}`}
          onClick={() => setConfirmOpen(true)}
        >
          Revoke
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Revoke invitation"
        description={`Revoke the invitation for ${invitation.email}? Their invite link will stop working.`}
        confirmLabel="Revoke"
        destructive
        onConfirm={revoke}
      />
    </li>
  )
}
