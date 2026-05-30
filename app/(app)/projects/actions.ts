"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { createProject, deleteProject } from "@/lib/projects"
import { createProjectSchema } from "@/lib/validation/project"
import { checkRateLimit } from "@/lib/ratelimit"
import { logActivity } from "@/lib/activity"
import type { ApiResult } from "@/lib/types"

function zodFieldErrors(
  flatten: { fieldErrors: Record<string, string[] | undefined> },
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, issues] of Object.entries(flatten.fieldErrors)) {
    out[key] = issues?.[0] ?? "Invalid"
  }
  return out
}

export async function createProjectAction(formData: FormData): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("projectWrite", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) return { ok: false, error: workspaceResult.error }

  const parsed = createProjectSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        error: "Invalid input.",
        code: "VALIDATION_ERROR",
        fieldErrors: zodFieldErrors(parsed.error.flatten()),
      },
    }
  }

  const result = await createProject({
    workspaceId: workspaceResult.data.id,
    name: parsed.data.name,
    description: parsed.data.description,
  })
  if (!result.ok) return { ok: false, error: result.error }

  await logActivity({
    workspaceId: workspaceResult.data.id,
    actorId: authResult.data.id,
    action: "project.created",
    targetType: "project",
    targetId: result.data.id,
    metadata: { name: result.data.name },
  })

  revalidatePath("/projects")
  revalidatePath("/dashboard")
  redirect("/projects")
}

export async function deleteProjectAction(projectId: string): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("projectWrite", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const result = await deleteProject(projectId, authResult.data.id)
  if (!result.ok) return { ok: false, error: result.error }

  await logActivity({
    workspaceId: result.data.workspaceId,
    actorId: authResult.data.id,
    action: "project.deleted",
    targetType: "project",
    targetId: projectId,
  })

  revalidatePath("/projects")
  revalidatePath("/dashboard")
  redirect("/projects")
}
