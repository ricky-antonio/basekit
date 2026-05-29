"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { updateProfile, uploadAvatar, deleteAccount } from "@/lib/profile"
import { updateWorkspace } from "@/lib/workspace-settings"
import { updateProfileSchema } from "@/lib/validation/profile"
import { updateWorkspaceSchema } from "@/lib/validation/workspace"
import { changePasswordSchema } from "@/lib/validation/auth"
import { checkRateLimit } from "@/lib/ratelimit"
import { createClient } from "@/lib/supabase/server"
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

export async function updateProfileAction(
  formData: FormData,
): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("settingsWrite", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const parsed = updateProfileSchema.safeParse({
    displayName: formData.get("displayName"),
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

  const result = await updateProfile(authResult.data.id, parsed.data.displayName)
  if (!result.ok) return result

  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}

export async function uploadAvatarAction(
  formData: FormData,
): Promise<ApiResult<string>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("avatarUpload", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const file = formData.get("avatar")
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: { error: "Please select an image file.", code: "VALIDATION_ERROR" },
    }
  }

  const result = await uploadAvatar(authResult.data.id, file)
  if (!result.ok) return result

  revalidatePath("/", "layout")
  return result
}

export async function updateWorkspaceAction(
  formData: FormData,
): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("settingsWrite", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) return { ok: false, error: workspaceResult.error }

  const parsed = updateWorkspaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
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

  const result = await updateWorkspace(
    workspaceResult.data.id,
    authResult.data.id,
    parsed.data.name,
    parsed.data.slug,
  )
  if (!result.ok) return result

  await logActivity({
    workspaceId: workspaceResult.data.id,
    actorId: authResult.data.id,
    action: "workspace.updated",
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  })

  revalidatePath("/", "layout")
  return { ok: true, data: undefined }
}

export async function changePasswordAction(
  formData: FormData,
): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("passwordChange", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
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

  const supabase = await createClient()

  // Re-authenticate before changing password to prevent session-hijack pivots.
  const email = authResult.data.email
  if (!email) {
    return {
      ok: false,
      error: {
        error: "Password change is only available for email/password accounts.",
        code: "FORBIDDEN",
      },
    }
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })

  if (verifyError) {
    return {
      ok: false,
      error: {
        error: "Current password is incorrect.",
        code: "VALIDATION_ERROR",
        fieldErrors: { currentPassword: "Incorrect password." },
      },
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    return {
      ok: false,
      error: { error: "Could not update your password. Please try again.", code: "INTERNAL_ERROR" },
    }
  }

  return { ok: true, data: undefined }
}

export async function deleteAccountAction(): Promise<ApiResult<void>> {
  const authResult = await requireAuth()
  if (!authResult.ok) return { ok: false, error: authResult.error }

  const rl = await checkRateLimit("accountDelete", authResult.data.id)
  if (!rl.success) return { ok: false, error: rl.error }

  const result = await deleteAccount(authResult.data.id)
  if (!result.ok) return result

  redirect("/login")
}
