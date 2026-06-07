import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getImpersonationContext } from "@/lib/impersonation"
import { getWorkspace } from "@/lib/workspace"
import { getSubscription } from "@/lib/subscription"
import { getProfile, deriveDisplayName } from "@/lib/profile"
import AppShell from "@/components/layout/AppShell"
import ImpersonateBanner from "@/components/admin/ImpersonateBanner"
import PastDueBanner from "@/components/billing/PastDueBanner"

// Authenticated app surfaces are never indexed; merges down onto every (app) page.
export const metadata = { robots: { index: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const user = authResult.data

  const [workspaceResult, profileResult, impersonation] = await Promise.all([
    getWorkspace(user),
    getProfile(user.id),
    getImpersonationContext(),
  ])

  // An authenticated user with no workspace (e.g. removed from the only workspace they
  // joined via invitation) has nowhere to land in the app shell. Send them to the stable
  // /no-workspace page rather than /login, which the middleware would bounce back here
  // (authed) → redirect loop. This layout runs before any child page renders.
  if (!workspaceResult.ok) redirect("/no-workspace")

  const subscriptionResult = await getSubscription(workspaceResult.data.id)
  const subscriptionStatus = subscriptionResult.ok ? subscriptionResult.data.status : null

  const workspaceName = workspaceResult.data.name
  const profile = profileResult.ok ? profileResult.data : null
  const displayName = deriveDisplayName(user, profile)
  const avatarUrl = profile?.avatar_url ?? null
  const isAdmin = profile?.role === "admin"

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ImpersonateBanner context={impersonation} />
      <PastDueBanner status={subscriptionStatus} />
      <div className="min-h-0 flex-1">
        <AppShell
          workspaceName={workspaceName}
          displayName={displayName}
          avatarUrl={avatarUrl}
          isAdmin={isAdmin}
        >
          {children}
        </AppShell>
      </div>
    </div>
  )
}
