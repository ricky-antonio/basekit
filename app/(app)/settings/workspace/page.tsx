import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import WorkspaceForm from "./WorkspaceForm"

export const metadata = { title: "Workspace Settings — basekit" }

export default async function WorkspaceSettingsPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) redirect("/dashboard")

  const { name, slug } = workspaceResult.data

  return <WorkspaceForm initialName={name} initialSlug={slug} />
}
