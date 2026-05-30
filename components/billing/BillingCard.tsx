import type { Subscription } from "@/lib/subscription"
import type { PlanName } from "@/lib/types"
import PlanBadge from "@/components/billing/PlanBadge"

interface BillingCardProps {
  subscription: Subscription | null
  activePlan: PlanName
}

function getPriceDisplay(activePlan: PlanName, priceId: string | null): string {
  if (activePlan === "free") return "$0/mo"
  const isProAnnual = priceId === process.env["STRIPE_PRICE_PRO_ANNUAL"]
  const isEntAnnual = priceId === process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"]
  if (activePlan === "pro") return isProAnnual ? "$23/mo (billed annually)" : "$29/mo"
  if (activePlan === "enterprise") return isEntAnnual ? "$79/mo (billed annually)" : "$99/mo"
  return "$0/mo"
}

// current_period_end and trial_end are timestamptz columns — Supabase returns them as
// ISO strings (e.g. "2026-06-30T07:34:13+00:00"), so parse them directly as dates.
function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function getTrialDaysRemaining(trialEnd: string | null | undefined): number | null {
  if (!trialEnd) return null
  const ms = new Date(trialEnd).getTime()
  if (Number.isNaN(ms)) return null
  const remaining = Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24))
  return remaining > 0 ? remaining : null
}

export default function BillingCard({ subscription, activePlan }: BillingCardProps) {
  const priceId = subscription?.stripe_price_id ?? null
  const priceDisplay = getPriceDisplay(activePlan, priceId)
  const trialDaysRemaining = getTrialDaysRemaining(subscription?.trial_end)
  const cancelDate =
    subscription?.cancel_at_period_end && subscription.current_period_end
      ? formatDate(subscription.current_period_end)
      : null

  return (
    <div
      className="rounded-xl p-6"
      style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Current plan
            </h2>
            <PlanBadge plan={activePlan} />
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {priceDisplay}
          </p>
        </div>
      </div>

      {trialDaysRemaining !== null && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm font-medium"
          style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
        >
          {trialDaysRemaining === 1
            ? "Your trial ends tomorrow"
            : `Your trial ends in ${trialDaysRemaining} days`}
        </div>
      )}

      {cancelDate && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--bg-surface-hover)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          Cancels on {cancelDate}
        </div>
      )}
    </div>
  )
}
