import PageHeader from "@/components/shared/PageHeader"
import AdminOverview from "@/components/admin/AdminOverview"

export const metadata = { title: "Admin — basekit" }

export default function AdminPage() {
  return (
    <div>
      <PageHeader title="Overview" subtitle="Revenue, users, and recent activity across basekit." />
      <AdminOverview />
    </div>
  )
}
