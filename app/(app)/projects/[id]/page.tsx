import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getProject } from "@/lib/projects"
import PageHeader from "@/components/shared/PageHeader"
import DeleteProjectButton from "./DeleteProjectButton"
import { IconArrowLeft } from "@tabler/icons-react"

export const metadata = { title: "Project — basekit" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const { id } = await params
  // RLS scopes this read to the caller's workspace — a project in another
  // workspace resolves to NOT_FOUND, so no extra ownership check is needed.
  const projectResult = await getProject(id)
  if (!projectResult.ok) notFound()
  const project = projectResult.data

  const created = new Date(project.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="max-w-3xl mx-auto w-full">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm mb-4 min-h-11"
        style={{ color: "var(--text-secondary)" }}
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        Back to projects
      </Link>

      <PageHeader
        title={project.name}
        subtitle={`Created ${created}`}
        action={<DeleteProjectButton projectId={project.id} projectName={project.name} />}
      />

      <section
        className="rounded-xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        {project.description ? (
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {project.description}
          </p>
        ) : (
          <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
            No description.
          </p>
        )}
      </section>
    </div>
  )
}
