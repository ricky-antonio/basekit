"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export interface ImpersonateBannerContext {
  targetUserId: string
  targetEmail: string | null
}

interface ImpersonateBannerProps {
  context: ImpersonateBannerContext | null
}

export default function ImpersonateBanner({ context }: ImpersonateBannerProps) {
  const [exiting, setExiting] = useState(false)

  if (!context) return null
  const { targetUserId, targetEmail } = context

  async function handleExit() {
    setExiting(true)
    try {
      const response = await fetch("/api/admin/impersonate/end", { method: "POST" })
      if (response.ok) {
        // Full reload so every server layout re-resolves without the impersonation cookie.
        window.location.href = `/admin/users/${targetUserId}`
        return
      }
      setExiting(false)
      toast.error("Could not exit impersonation. Please try again.")
    } catch {
      setExiting(false)
      toast.error("Could not exit impersonation. Please try again.")
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-[var(--z-impersonate-banner)] flex w-full shrink-0 items-center justify-between gap-3 px-4 py-2"
      style={{ background: "var(--danger-solid)", color: "#FFFFFF" }}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <IconAlertTriangle size={16} aria-hidden="true" className="shrink-0" />
        <span className="truncate">
          Impersonating <span className="font-semibold">{targetEmail ?? "this user"}</span>
        </span>
      </div>
      <Button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        aria-label="Exit impersonation"
        className="min-h-9 shrink-0 border border-white/40 bg-white/15 text-white hover:bg-white/25"
      >
        {exiting ? "Exiting…" : "Exit impersonation"}
      </Button>
    </div>
  )
}
