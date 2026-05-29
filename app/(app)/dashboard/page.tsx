import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getSubscription } from "@/lib/subscription"
import { getProfile, deriveDisplayName } from "@/lib/profile"
import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { Badge } from "@/components/ui/badge"
import { IconFolder } from "@tabler/icons-react"

export const metadata = { title: "Dashboard — basekit" }

export default async function DashboardPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const user = authResult.data

  const [workspaceResult, profileResult] = await Promise.all([
    getWorkspace(user),
    getProfile(user.id),
  ])

  if (!workspaceResult.ok) redirect("/login")

  const workspace = workspaceResult.data
  const displayName = deriveDisplayName(user, profileResult.ok ? profileResult.data : null)

  const subscriptionResult = await getSubscription(workspace.id)
  const planName = subscriptionResult.ok ? subscriptionResult.data.plan_name : "free"
  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1)

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader
        title={`Hello, ${displayName}`}
        subtitle={`Welcome back to ${workspace.name}`}
      />

      {/* Workspace overview card */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {workspace.name}
          </h2>
          <Badge
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
            style={{
              background: "var(--brand-bg-soft)",
              color: "var(--brand-primary)",
              border: "1px solid var(--brand-border-soft)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {planLabel}
          </Badge>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Workspace slug:{" "}
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "var(--bg-surface-hover)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {workspace.slug}
          </span>
        </p>
      </div>

      {/* Projects empty state */}
      <EmptyState
        icon={<IconFolder size={40} />}
        headline="No projects yet"
        body="Projects are where your work lives. Create your first one to get started."
        actionLabel="Create project"
        actionHref="/projects/new"
      />
    </div>
  )
}
