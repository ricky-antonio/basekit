import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getWorkspaceSubscription, getActivePlan } from "@/lib/billing"
import { getUsage } from "@/lib/usage"
import { PLANS } from "@/lib/plans"
import PageHeader from "@/components/shared/PageHeader"
import BillingCard from "@/components/billing/BillingCard"
import UsageBar from "@/components/billing/UsageBar"
import PricingTable from "@/components/billing/PricingTable"
import UpgradedToast from "./UpgradedToast"
import BillingActions from "./BillingActions"

export const metadata = { title: "Billing — basekit" }

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const params = await searchParams

  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) redirect("/dashboard")

  const workspaceId = workspaceResult.data.id

  const [subscriptionResult, activePlan, projectsUsageResult, membersUsageResult] =
    await Promise.all([
      getWorkspaceSubscription(workspaceId),
      getActivePlan(workspaceId),
      getUsage(workspaceId, "projects"),
      getUsage(workspaceId, "members"),
    ])

  const subscription = subscriptionResult.ok ? subscriptionResult.data : null
  const plan = PLANS[activePlan]
  const projectsUsed = projectsUsageResult.ok ? projectsUsageResult.data : 0
  const membersUsed = membersUsageResult.ok ? membersUsageResult.data : 0
  const isPastDue = subscription?.status === "past_due"

  const proPriceIds = {
    monthly: process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_PRO_ANNUAL"] ?? "",
  }
  const enterprisePriceIds = {
    monthly: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"] ?? "",
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      {params.upgraded === "true" && <UpgradedToast />}

      <PageHeader title="Billing" subtitle="Manage your subscription and payment details." />

      {isPastDue && (
        <div
          role="alert"
          className="mb-6 rounded-xl px-5 py-4 text-sm font-medium"
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            color: "var(--warning-text)",
          }}
        >
          Your last payment failed. Please update your payment method to keep your plan active.{" "}
          <span className="font-semibold">Use &quot;Manage billing&quot; to update it.</span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <BillingCard subscription={subscription} activePlan={activePlan} />

        <div className="flex flex-col gap-4 rounded-xl p-6" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Usage
          </h2>
          <UsageBar label="Projects" used={projectsUsed} maxCount={plan.projectLimit} />
          <UsageBar label="Members" used={membersUsed} maxCount={plan.memberLimit} />
        </div>

        <BillingActions
          activePlan={activePlan}
          stripeCustomerId={subscription?.stripe_customer_id ?? null}
        />

        <div className="pt-2">
          <h2 className="text-base font-semibold mb-6" style={{ color: "var(--text-primary)" }}>
            Plans
          </h2>
          <PricingTable
            currentPlan={activePlan}
            proPriceIds={proPriceIds}
            enterprisePriceIds={enterprisePriceIds}
          />
        </div>
      </div>
    </div>
  )
}
