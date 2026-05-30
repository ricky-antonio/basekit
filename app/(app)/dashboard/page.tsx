import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getActivePlan } from "@/lib/billing"
import { listProjects } from "@/lib/projects"
import { getUsage } from "@/lib/usage"
import { getProfile, deriveDisplayName } from "@/lib/profile"
import { PLANS } from "@/lib/plans"
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

  // getActivePlan is status-aware (a canceled/unpaid subscription collapses to
  // 'free'), so the badge matches the limits the projects page actually enforces.
  const [plan, projectsResult, membersUsageResult] = await Promise.all([
    getActivePlan(workspace.id),
    listProjects(workspace.id),
    getUsage(workspace.id, "members"),
  ])

  const planLabel = PLANS[plan].label
  const projects = projectsResult.ok ? projectsResult.data : []
  const memberCount = membersUsageResult.ok ? membersUsageResult.data : 1

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
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
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
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{projects.length}</span>{" "}
            {projects.length === 1 ? "project" : "projects"}
          </span>
          <span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{memberCount}</span>{" "}
            {memberCount === 1 ? "member" : "members"}
          </span>
          <span>
            Slug:{" "}
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
          </span>
        </div>
      </div>

      {/* Projects */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={40} />}
          headline="No projects yet"
          body="Projects are where your work lives. Create your first one to get started."
          actionLabel="Create project"
          actionHref="/projects/new"
        />
      ) : (
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Recent projects
            </h2>
            <Link href="/projects" className="text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {projects.slice(0, 5).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 min-h-11 transition-colors hover:bg-[var(--bg-surface-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  <IconFolder size={16} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm truncate">{project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
