import { Suspense } from "react"
import PageHeader from "@/components/shared/PageHeader"
import UserTable from "@/components/admin/UserTable"

export const metadata = { title: "Users — admin" }

// UserTable reads the URL via useSearchParams, which Next requires be wrapped in a
// Suspense boundary so the route can still be prerendered.
export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader title="Users" subtitle="Search, filter, and drill into any account." />
      <Suspense>
        <UserTable />
      </Suspense>
    </div>
  )
}
