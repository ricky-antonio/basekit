import { Suspense } from "react"
import PageHeader from "@/components/shared/PageHeader"
import SubscriptionsTable from "@/components/admin/SubscriptionsTable"

export const metadata = { title: "Subscriptions — admin" }

export default function AdminSubscriptionsPage() {
  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Every workspace subscription, filterable by status." />
      <Suspense>
        <SubscriptionsTable />
      </Suspense>
    </div>
  )
}
