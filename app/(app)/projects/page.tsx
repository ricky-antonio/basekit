import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { IconFolder } from "@tabler/icons-react"

export const metadata = { title: "Projects — basekit" }

export default function ProjectsPage() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="Projects" subtitle="Manage your projects." />
      <EmptyState
        icon={<IconFolder size={40} />}
        headline="Projects are coming soon"
        body="The full projects experience ships in a later phase. Check back as the product evolves."
      />
    </div>
  )
}
