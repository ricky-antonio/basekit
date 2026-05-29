import * as Sentry from "@sentry/nextjs"
import { createClient } from "@/lib/supabase/server"
import type { ApiResult } from "@/lib/types"
import type { Workspace } from "@/lib/workspace"

export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  name: string,
  slug: string,
): Promise<ApiResult<Workspace>> {
  const supabase = await createClient()

  // Authorization: only the workspace owner can update. RLS enforces this at the DB
  // level too, but the explicit check produces a friendlier FORBIDDEN error.
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .single()

  if (workspaceError || !workspace) {
    return {
      ok: false,
      error: { error: "Workspace not found.", code: "NOT_FOUND" },
    }
  }

  if (workspace.owner_id !== userId) {
    return {
      ok: false,
      error: {
        error: "Only the workspace owner can update these settings.",
        code: "FORBIDDEN",
      },
    }
  }

  // Check slug uniqueness before attempting update
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .neq("id", workspaceId)
    .maybeSingle()

  if (existing) {
    return {
      ok: false,
      error: {
        error: "That slug is already taken. Please choose a different one.",
        code: "VALIDATION_ERROR",
        fieldErrors: { slug: "Slug is already in use." },
      },
    }
  }

  const { data, error } = await supabase
    .from("workspaces")
    .update({ name, slug })
    .eq("id", workspaceId)
    .select("id, name, slug, owner_id, created_at")
    .single()

  if (error || !data) {
    console.error("[workspace-settings.updateWorkspace] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: {
        error: "Could not update workspace settings. Please try again.",
        code: "INTERNAL_ERROR",
      },
    }
  }

  return { ok: true, data }
}
