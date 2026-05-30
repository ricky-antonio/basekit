import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { listProjects } from "@/lib/projects"
import { getUsage } from "@/lib/usage"
import { getActivePlan } from "@/lib/billing"
import { PLANS } from "@/lib/plans"
import PageHeader from "@/components/shared/PageHeader"
import EmptyState from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { IconFolder, IconPlus } from "@tabler/icons-react"

export const metadata = { title: "Projects — basekit" }

export default async function ProjectsPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) redirect("/login")
  const workspace = workspaceResult.data

  const [projectsResult, usageResult, plan] = await Promise.all([
    listProjects(workspace.id),
    getUsage(workspace.id, "projects"),
    getActivePlan(workspace.id),
  ])

  const projects = projectsResult.ok ? projectsResult.data : []
  const used = usageResult.ok ? usageResult.data : projects.length
  const limit = PLANS[plan].projectLimit
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0

  const newButton = (
    <Button asChild className="min-h-11">
      <Link href="/projects/new" className="flex items-center gap-1.5">
        <IconPlus size={16} aria-hidden="true" />
        New project
      </Link>
    </Button>
  )

  return (
    <div className="max-w-5xl mx-auto w-full">
      <PageHeader title="Projects" subtitle="Projects in your workspace." action={newButton} />

      {/* Usage summary — the full UsageBar component (amber/red states) lands in 2.3. */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--text-secondary)" }}>Projects used</span>
          <span style={{ color: "var(--text-primary)" }} className="font-medium">
            {limit === null ? `${used} · Unlimited` : `${used} of ${limit}`}
          </span>
        </div>
        {limit !== null && (
          <div
            className="mt-2 h-2 w-full rounded-full overflow-hidden"
            style={{ background: "var(--bg-surface-hover)" }}
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, background: "var(--brand-primary)" }}
            />
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<IconFolder size={40} />}
          headline="No projects yet"
          body="Projects are where your work lives. Create your first one to get started."
          actionLabel="Create project"
          actionHref="/projects/new"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-xl p-4 min-h-11 transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {project.name}
                </h3>
                {project.description && (
                  <p className="mt-1 text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                    {project.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
