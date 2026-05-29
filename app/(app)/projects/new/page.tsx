import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { IconFolder } from "@tabler/icons-react"

export const metadata = { title: "New project — basekit" }

export default function NewProjectPage() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="New project" subtitle="Start a new project." />
      <EmptyState
        icon={<IconFolder size={40} />}
        headline="Project creation is coming soon"
        body="The create-project flow ships in a later phase."
        actionLabel="Back to dashboard"
        actionHref="/dashboard"
      />
    </div>
  )
}
