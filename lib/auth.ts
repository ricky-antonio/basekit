import type { User } from "@supabase/supabase-js"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getImpersonationContext } from "@/lib/impersonation"
import type { ApiResult, UserRole } from "@/lib/types"

export type AuthUser = User & { role: UserRole }

// The real session user behind the request — never the impersonated target. Use this
// for authorization (requireAdmin) so admin powers survive an active impersonation.
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// The effective app identity. When an admin holds a valid impersonation cookie, this
// returns the TARGET user so every Server Component / Server Action keyed off getUser()
// renders the target's data. Honored only for the admin who minted the cookie.
export async function getUser(): Promise<User | null> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return null

  const impersonated = await resolveImpersonatedUser(sessionUser)
  return impersonated ?? sessionUser
}

async function resolveImpersonatedUser(sessionUser: User): Promise<User | null> {
  const context = await getImpersonationContext()
  if (!context || context.adminId !== sessionUser.id) return null

  // Defense in depth: only honor the cookie if the session user is actually an admin —
  // a stale cookie on a demoted account must not grant identity-swapping.
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single()
  if (profile?.role !== "admin") return null

  const service = createServiceClient()
  const { data } = await service.auth.admin.getUserById(context.targetUserId)
  return data?.user ?? null
}

export async function requireAuth(): Promise<ApiResult<User>> {
  const user = await getUser()
  if (!user) {
    return {
      ok: false,
      error: {
        error: "You must be signed in to access this resource.",
        code: "UNAUTHENTICATED",
      },
    }
  }
  return { ok: true, data: user }
}

export async function requireAdmin(): Promise<ApiResult<AuthUser>> {
  // Authorize against the real session user, not getUser() — an admin who is currently
  // impersonating still has admin rights (and must, to end the session / use admin UI).
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return {
      ok: false,
      error: {
        error: "You must be signed in to access this resource.",
        code: "UNAUTHENTICATED",
      },
    }
  }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single()

  if (error || !profile) {
    return {
      ok: false,
      error: {
        error: "Could not verify your permissions.",
        code: "INTERNAL_ERROR",
      },
    }
  }

  if (profile.role !== "admin") {
    return {
      ok: false,
      error: {
        error: "You do not have permission to access this resource.",
        code: "FORBIDDEN",
      },
    }
  }

  return {
    ok: true,
    data: { ...sessionUser, role: profile.role as UserRole },
  }
}
