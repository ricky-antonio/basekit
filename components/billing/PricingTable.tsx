"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { IconCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { PlanName } from "@/lib/types"

interface PricingTableProps {
  currentPlan: PlanName
  proPriceIds: { monthly: string; annual: string }
  enterprisePriceIds: { monthly: string; annual: string }
}

const PLANS_DISPLAY = [
  {
    name: "free" as PlanName,
    label: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    annualSubline: "/mo",
    description: "Get started for free",
    features: ["Up to 3 projects", "1 team member", "Email auth"],
    popular: false,
  },
  {
    name: "pro" as PlanName,
    label: "Pro",
    monthlyPrice: "$29",
    annualPrice: "$23",
    annualSubline: "/mo billed annually",
    description: "For growing teams",
    features: ["Unlimited projects", "Up to 10 members", "Google auth", "Custom domain"],
    popular: true,
  },
  {
    name: "enterprise" as PlanName,
    label: "Enterprise",
    monthlyPrice: "$99",
    annualPrice: "$79",
    annualSubline: "/mo billed annually",
    description: "For large organizations",
    features: ["Unlimited everything", "SSO / SAML", "Audit log", "Dedicated support"],
    popular: false,
  },
]

export default function PricingTable({
  currentPlan,
  proPriceIds,
  enterprisePriceIds,
}: PricingTableProps) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly")
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)

  function getPriceId(planName: PlanName): string | null {
    if (planName === "pro") return interval === "monthly" ? proPriceIds.monthly : proPriceIds.annual
    if (planName === "enterprise")
      return interval === "monthly" ? enterprisePriceIds.monthly : enterprisePriceIds.annual
    return null
  }

  async function handleUpgrade(priceId: string) {
    setLoadingPriceId(priceId)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not start checkout. Please try again.")
        setLoadingPriceId(null)
        return
      }
      // Don't reset loading — the browser is navigating away to Stripe Checkout.
      // Resetting here flashes the button label back before the redirect completes.
      window.location.href = data.url
    } catch {
      toast.error("Could not start checkout. Please try again.")
      setLoadingPriceId(null)
    }
  }

  return (
    <div>
      {/* Billing interval toggle */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "var(--bg-surface-hover)" }}>
        <button
          onClick={() => setInterval("monthly")}
          aria-pressed={interval === "monthly"}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            interval === "monthly"
              ? "shadow-sm"
              : "hover:opacity-80",
          )}
          style={
            interval === "monthly"
              ? { background: "var(--bg-surface)", color: "var(--text-primary)" }
              : { color: "var(--text-muted)" }
          }
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("annual")}
          aria-pressed={interval === "annual"}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            interval === "annual"
              ? "shadow-sm"
              : "hover:opacity-80",
          )}
          style={
            interval === "annual"
              ? { background: "var(--bg-surface)", color: "var(--text-primary)" }
              : { color: "var(--text-muted)" }
          }
        >
          Annual
          <span className="ml-1.5 text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>
            Save 20%
          </span>
        </button>
      </div>

      {/* Plan columns */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS_DISPLAY.map((plan) => {
          const isCurrent = plan.name === currentPlan
          const priceId = getPriceId(plan.name)
          const price = interval === "monthly" ? plan.monthlyPrice : plan.annualPrice
          const subline = interval === "annual" ? plan.annualSubline : "/mo"
          const isLoading = priceId !== null && loadingPriceId === priceId

          // Paid users change plans through the Stripe portal, not Checkout — a second
          // Checkout would 409 at the API guard. Only free users get an active Upgrade CTA.
          const isPaidUser = currentPlan !== "free"
          const canUpgradeHere = !isCurrent && !isPaidUser && priceId !== null
          const ctaLabel = isCurrent
            ? "Current plan"
            : isPaidUser
              ? "Manage in billing portal"
              : isLoading
                ? "Redirecting to Stripe…"
                : `Upgrade to ${plan.label}`
          const ctaAriaLabel = isCurrent
            ? `Current plan: ${plan.label}`
            : isPaidUser
              ? `Manage ${plan.label} in the billing portal`
              : `Upgrade to ${plan.label}`

          return (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-xl p-6 flex flex-col gap-4",
                plan.popular ? "ring-2" : "",
              )}
              style={{
                background: "var(--bg-surface)",
                border: plan.popular ? "none" : "1px solid var(--border-default)",
                boxShadow: plan.popular ? `0 0 0 2px var(--brand-primary)` : undefined,
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--brand-primary)", color: "var(--text-on-brand)" }}
                >
                  Most popular
                </div>
              )}

              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                  {plan.label}
                </h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {plan.description}
                </p>
              </div>

              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {price}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {subline}
                </span>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <IconCheck size={14} style={{ color: "var(--brand-primary)" }} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={canUpgradeHere && priceId ? () => handleUpgrade(priceId) : undefined}
                disabled={!canUpgradeHere}
                variant={plan.popular ? "default" : "outline"}
                className="w-full"
                aria-label={ctaAriaLabel}
              >
                {ctaLabel}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
