import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { IconUsers } from "@tabler/icons-react"

export const metadata = { title: "Team — basekit" }

export default function TeamPage() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="Team" subtitle="Manage your workspace members and invitations." />
      <EmptyState
        icon={<IconUsers size={40} />}
        headline="Team management is coming in Phase 3"
        body="Invitations, member roles, and removals will live here."
      />
    </div>
  )
}
