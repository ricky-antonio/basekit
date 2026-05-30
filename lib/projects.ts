import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import { canCreateProject, incrementUsage, decrementUsage } from "@/lib/usage"
import type { ApiResult } from "@/lib/types"
import type { Database } from "@/lib/database.types"

export type Project = Database["public"]["Tables"]["projects"]["Row"]

const PROJECT_COLUMNS = "id, workspace_id, name, description, created_at"

// Where a free user is sent when they hit the project limit.
const UPGRADE_URL = "/settings/billing"

export async function listProjects(workspaceId: string): Promise<ApiResult<Project[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[projects.listProjects] failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load projects. Please try again.", code: "INTERNAL_ERROR" } }
  }

  return { ok: true, data: data ?? [] }
}

export async function getProject(projectId: string): Promise<ApiResult<Project>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle()

  if (error) {
    console.error("[projects.getProject] failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load the project. Please try again.", code: "INTERNAL_ERROR" } }
  }

  if (!data) {
    return { ok: false, error: { error: "Project not found.", code: "NOT_FOUND" } }
  }

  return { ok: true, data }
}

interface CreateProjectParams {
  workspaceId: string
  name: string
  description?: string | null
}

export async function createProject(params: CreateProjectParams): Promise<ApiResult<Project>> {
  const { workspaceId, name, description = null } = params

  // Plan-limit gate. canCreateProject fails OPEN on a DB error (see lib/usage.ts),
  // so a transient outage never blocks a legitimate create.
  if (!(await canCreateProject(workspaceId))) {
    return {
      ok: false,
      error: {
        error: "You've reached the project limit for your plan. Upgrade to create more.",
        code: "LIMIT_EXCEEDED",
        upgradeUrl: UPGRADE_URL,
      },
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name, description })
    .select(PROJECT_COLUMNS)
    .single()

  if (error || !data) {
    console.error("[projects.createProject] insert failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not create the project. Please try again.", code: "INTERNAL_ERROR" } }
  }

  // Best-effort counter bump — the projects rows are the source of truth, so a
  // drift here is logged (in incrementUsage) rather than failing the create.
  await incrementUsage(workspaceId, "projects")

  return { ok: true, data }
}

// Only the workspace owner or an admin may delete a project. RLS enforces this at
// the DB layer (projects_delete_owner_or_admin); the explicit role check produces a
// friendlier FORBIDDEN than a silent 0-row delete.
export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<ApiResult<{ workspaceId: string }>> {
  const supabase = await createClient()

  const { data: project, error: lookupError } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle()

  if (lookupError) {
    console.error("[projects.deleteProject] lookup failed", lookupError)
    Sentry.captureException(lookupError)
    return { ok: false, error: { error: "Could not delete the project. Please try again.", code: "INTERNAL_ERROR" } }
  }

  if (!project) {
    return { ok: false, error: { error: "Project not found.", code: "NOT_FOUND" } }
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return {
      ok: false,
      error: { error: "Only workspace owners and admins can delete projects.", code: "FORBIDDEN" },
    }
  }

  const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId)

  if (deleteError) {
    console.error("[projects.deleteProject] delete failed", deleteError)
    Sentry.captureException(deleteError)
    return { ok: false, error: { error: "Could not delete the project. Please try again.", code: "INTERNAL_ERROR" } }
  }

  await decrementUsage(project.workspace_id, "projects")

  return { ok: true, data: { workspaceId: project.workspace_id } }
}
