import { Suspense } from "react"
import PageHeader from "@/components/shared/PageHeader"
import ActivityLog from "@/components/admin/ActivityLog"

export const metadata = { title: "Activity — admin — basekit" }

export default function AdminActivityPage() {
  return (
    <div>
      <PageHeader title="Activity log" subtitle="Every audited action, including admin overrides and impersonation." />
      <Suspense>
        <ActivityLog />
      </Suspense>
    </div>
  )
}
