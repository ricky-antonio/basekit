"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

interface PastDueBannerProps {
  status: string | null
}

export default function PastDueBanner({ status }: PastDueBannerProps) {
  const [loading, setLoading] = useState(false)

  if (status !== "past_due") return null

  async function handleUpdatePayment() {
    setLoading(true)
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        toast.error(data.error ?? "Could not open billing portal.")
        setLoading(false)
        return
      }
      // Browser navigates away to Stripe — don't reset loading (avoids a label flash).
      window.location.href = data.url
    } catch {
      toast.error("Could not open billing portal.")
      setLoading(false)
    }
  }

  return (
    <div
      role="alert"
      className="flex w-full shrink-0 flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      style={{
        background: "var(--danger-bg)",
        color: "var(--danger-text)",
        borderBottom: "1px solid var(--danger-border)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <IconAlertTriangle size={18} aria-hidden="true" className="shrink-0" />
        <span>
          Your last payment failed. Update your payment method to keep your subscription active.
        </span>
      </div>
      <Button
        type="button"
        onClick={handleUpdatePayment}
        disabled={loading}
        className="min-h-9 shrink-0"
        style={{ background: "var(--danger-solid)", color: "#FFFFFF" }}
      >
        {loading ? "Redirecting…" : "Update payment method"}
      </Button>
    </div>
  )
}
