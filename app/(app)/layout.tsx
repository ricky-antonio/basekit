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

  // An authenticated user with no workspace (e.g. removed from the only workspace they
  // joined via invitation) has nowhere to land in the app shell. Send them to the stable
  // /no-workspace page rather than /login, which the middleware would bounce back here
  // (authed) → redirect loop. This layout runs before any child page renders.
  if (!workspaceResult.ok) redirect("/no-workspace")

  const workspaceName = workspaceResult.data.name
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
