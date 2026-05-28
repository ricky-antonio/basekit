import type { User } from "@supabase/supabase-js"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import type { ApiResult } from "@/lib/types"
import type { Database } from "@/lib/database.types"

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function deriveSlug(email: string): string {
  const base = slugify(email.split("@")[0] ?? "workspace")
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

export async function getWorkspace(user: User): Promise<ApiResult<Workspace>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, owner_id, created_at")
    .eq("owner_id", user.id)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: {
        error: "Workspace not found.",
        code: "NOT_FOUND",
      },
    }
  }

  return { ok: true, data }
}

export async function bootstrapWorkspace(
  userId: string,
  email: string,
): Promise<ApiResult<string>> {
  const supabase = createServiceClient()

  const name = email.split("@")[0] ?? "My Workspace"
  const slug = deriveSlug(email)

  const { data, error } = await supabase.rpc("bootstrap_workspace", {
    p_user_id: userId,
    p_name: name,
    p_slug: slug,
  })

  if (error || !data) {
    return {
      ok: false,
      error: {
        error: "Could not create your workspace. Please try again.",
        code: "INTERNAL_ERROR",
      },
    }
  }

  const workspaceId = data as string

  await logActivity({
    workspaceId,
    actorId: userId,
    action: "workspace.created",
    metadata: { name, slug },
  })

  return { ok: true, data: workspaceId }
}
