"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import AcceptInvitationCard from "@/components/team/AcceptInvitationCard"
import type { InvitationPreview } from "@/lib/invitations"

const NOT_FOUND: InvitationPreview = {
  status: "not_found",
  workspaceName: null,
  inviterName: null,
  email: null,
  role: null,
}

const INVALID_MESSAGES: Record<"expired" | "accepted" | "not_found", string> = {
  expired: "This invitation has expired. Ask the workspace owner to send a new one.",
  accepted: "This invitation has already been accepted.",
  not_found: "This invitation is no longer valid.",
}

interface AcceptInvitationProps {
  token: string
  isAuthenticated: boolean
}

// Drives the public /team/accept page: fetches the service-role preview, then either
// shows the accept card (valid) or a clear terminal state. Accept POSTs to the existing
// /api/team/accept route, then navigates to the dashboard.
export default function AcceptInvitation({ token, isAuthenticated }: AcceptInvitationProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/team/invitation?token=${encodeURIComponent(token)}`)
      .then(async (response) => (response.ok ? response.json() : NOT_FOUND))
      .then((data: InvitationPreview) => {
        if (active) setPreview(data)
      })
      .catch(() => {
        if (active) setPreview(NOT_FOUND)
      })
    return () => {
      active = false
    }
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    try {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (response.ok) {
        toast.success("You've joined the workspace.")
        // Browser navigates away — leave the button in its loading state (no flash back).
        router.push("/dashboard")
        return
      }
      const error = await response.json().catch(() => null)
      toast.error(error?.error ?? "Could not accept the invitation. Please try again.")
      setAccepting(false)
    } catch {
      toast.error("Could not accept the invitation. Please try again.")
      setAccepting(false)
    }
  }

  function handleDecline() {
    router.push("/")
  }

  if (!preview) {
    return (
      <div
        data-testid="accept-skeleton"
        className="rounded-xl p-6 space-y-3"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <Skeleton className="h-6 w-40 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  if (preview.status === "valid") {
    const signupHref =
      `/signup?invite=${encodeURIComponent(token)}` +
      (preview.email ? `&email=${encodeURIComponent(preview.email)}` : "")
    return (
      <AcceptInvitationCard
        workspaceName={preview.workspaceName}
        inviterName={preview.inviterName}
        isAuthenticated={isAuthenticated}
        accepting={accepting}
        signupHref={signupHref}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    )
  }

  return (
    <div
      role="alert"
      className="rounded-xl p-6 text-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
        Invitation unavailable
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {INVALID_MESSAGES[preview.status]}
      </p>
      <Button asChild variant="outline" className="mt-5 min-h-11">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </div>
  )
}
