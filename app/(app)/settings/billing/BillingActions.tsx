"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import type { PlanName } from "@/lib/types"

interface BillingActionsProps {
  activePlan: PlanName
  stripeCustomerId: string | null
}

export default function BillingActions({ activePlan, stripeCustomerId }: BillingActionsProps) {
  const router = useRouter()
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  if (activePlan === "free") return null

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not open billing portal.")
        setPortalLoading(false)
        return
      }
      // Don't reset loading — the browser is navigating away to Stripe. Resetting here
      // flashes the label back to "Manage billing" before the redirect completes.
      window.location.href = data.url
    } catch {
      toast.error("Could not open billing portal.")
      setPortalLoading(false)
    }
  }

  async function handleCancel() {
    const res = await fetch("/api/billing/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? "Could not cancel subscription.")
    }
    toast.success("Subscription will cancel at the end of the billing period.")
    setCancelDialogOpen(false)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-3">
      {stripeCustomerId && (
        <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
          {portalLoading ? "Redirecting…" : "Manage billing"}
        </Button>
      )}

      <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
        Cancel subscription
      </Button>

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel subscription"
        description="Your plan stays active until the end of the current billing period. Are you sure?"
        confirmLabel="Yes, cancel"
        onConfirm={handleCancel}
        destructive
      />
    </div>
  )
}
