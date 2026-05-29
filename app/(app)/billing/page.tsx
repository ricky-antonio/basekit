import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { IconCreditCard } from "@tabler/icons-react"

export const metadata = { title: "Billing — basekit" }

export default function BillingPage() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="Billing" subtitle="Manage your subscription and payment details." />
      <EmptyState
        icon={<IconCreditCard size={40} />}
        headline="Billing is coming in Phase 2"
        body="Plan upgrades, Stripe Checkout, and the customer portal land here next."
      />
    </div>
  )
}
