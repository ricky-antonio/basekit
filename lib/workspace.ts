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
  const localPart = email.split("@")[0] ?? ""
  const slugged = slugify(localPart)
  const base = slugged.length > 0 ? slugged : "workspace"
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

function deriveName(email: string): string {
  const localPart = email.split("@")[0]?.trim() ?? ""
  return localPart.length > 0 ? localPart : "My Workspace"
}

export async function getWorkspace(user: User): Promise<ApiResult<Workspace>> {
  const supabase = await createClient()

  // Resolve the user's first workspace via membership (owners AND invited members)
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError || !membership) {
    return {
      ok: false,
      error: {
        error: "Workspace not found.",
        code: "NOT_FOUND",
      },
    }
  }

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, owner_id, created_at")
    .eq("id", membership.workspace_id)
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

export interface WorkspaceOwnerContact {
  email: string
  ownerName: string | null
  workspaceName: string
}

// Resolves the workspace owner's email + display name for transactional emails
// (billing notices). Service-role only: it reads auth.users via auth.admin, which
// is never reachable from a user-scoped client. Call from server-only contexts
// (the Stripe webhook), never a Server Component.
export async function getWorkspaceOwnerContact(
  workspaceId: string,
): Promise<ApiResult<WorkspaceOwnerContact>> {
  const supabase = createServiceClient()

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("name, owner_id")
    .eq("id", workspaceId)
    .maybeSingle()

  if (workspaceError || !workspace) {
    return { ok: false, error: { error: "Workspace not found.", code: "NOT_FOUND" } }
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
    workspace.owner_id,
  )

  const email = userData?.user?.email
  if (userError || !email) {
    return { ok: false, error: { error: "Workspace owner has no email.", code: "NOT_FOUND" } }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", workspace.owner_id)
    .maybeSingle()

  return {
    ok: true,
    data: {
      email,
      ownerName: profile?.display_name ?? null,
      workspaceName: workspace.name,
    },
  }
}

export async function bootstrapWorkspace(
  userId: string,
  email: string,
): Promise<ApiResult<string>> {
  const supabase = createServiceClient()

  const name = deriveName(email)
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
