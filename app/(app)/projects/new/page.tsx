import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getActivePlan } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import PageHeader from "@/components/shared/PageHeader"
import NewProjectForm from "./NewProjectForm"

export const metadata = { title: "New project — basekit" }

export default async function NewProjectPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) redirect("/login")

  const plan = await getActivePlan(workspaceResult.data.id)

  return (
    <div className="max-w-2xl mx-auto w-full">
      <PageHeader title="New project" subtitle="Create a new project in your workspace." />
      <NewProjectForm currentPlan={PLANS[plan].label} />
    </div>
  )
}
