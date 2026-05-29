import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getProfile, deriveDisplayName } from "@/lib/profile"
import AppShell from "@/components/layout/AppShell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const user = authResult.data

  const [workspaceResult, profileResult] = await Promise.all([
    getWorkspace(user),
    getProfile(user.id),
  ])

  const workspaceName = workspaceResult.ok ? workspaceResult.data.name : "My Workspace"
  const profile = profileResult.ok ? profileResult.data : null
  const displayName = deriveDisplayName(user, profile)
  const avatarUrl = profile?.avatar_url ?? null

  return (
    <AppShell
      workspaceName={workspaceName}
      displayName={displayName}
      avatarUrl={avatarUrl}
    >
      {children}
    </AppShell>
  )
}
