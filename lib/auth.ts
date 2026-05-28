import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { ApiResult, UserRole } from "@/lib/types"

export type AuthUser = User & { role: UserRole }

export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
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
  const userResult = await requireAuth()
  if (!userResult.ok) return userResult

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userResult.data.id)
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
    data: { ...userResult.data, role: profile.role as UserRole },
  }
}
