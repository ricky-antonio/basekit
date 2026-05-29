import * as Sentry from "@sentry/nextjs"
import type { User } from "@supabase/supabase-js"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { ApiResult } from "@/lib/types"
import type { Database } from "@/lib/database.types"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

// Must stay in sync with the avatars bucket policy in supabase/migrations/combined.sql
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}
const ALLOWED_AVATAR_MIME = Object.keys(MIME_TO_EXT)

export function deriveDisplayName(user: User, profile?: Profile | null): string {
  return (
    profile?.display_name ??
    (user.user_metadata as { display_name?: string } | undefined)?.display_name ??
    user.email ??
    "User"
  )
}

export async function getProfile(userId: string): Promise<ApiResult<Profile>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, updated_at")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: { error: "Profile not found.", code: "NOT_FOUND" },
    }
  }

  return { ok: true, data }
}

export async function updateProfile(
  userId: string,
  displayName: string,
): Promise<ApiResult<Profile>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId)
    .select("id, display_name, avatar_url, role, updated_at")
    .single()

  if (error || !data) {
    console.error("[profile.updateProfile] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not update your profile. Please try again.", code: "INTERNAL_ERROR" },
    }
  }

  return { ok: true, data }
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<ApiResult<string>> {
  if (file.size > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: { error: "Avatar must be 2 MB or smaller.", code: "VALIDATION_ERROR" },
    }
  }

  if (!ALLOWED_AVATAR_MIME.includes(file.type)) {
    return {
      ok: false,
      error: {
        error: "Avatar must be a JPEG, PNG, or WebP image.",
        code: "VALIDATION_ERROR",
      },
    }
  }

  const supabase = await createClient()
  const ext = MIME_TO_EXT[file.type] ?? "jpg"
  const path = `${userId}/avatar.${ext}`

  // Remove any prior avatar files in the user's folder (different extension)
  const { data: existing } = await supabase.storage.from("avatars").list(userId)
  const stale = (existing ?? [])
    .filter((f) => f.name !== `avatar.${ext}`)
    .map((f) => `${userId}/${f.name}`)
  if (stale.length > 0) {
    await supabase.storage.from("avatars").remove(stale)
  }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    console.error("[profile.uploadAvatar] storage upload failed", uploadError)
    Sentry.captureException(uploadError)
    return {
      ok: false,
      error: { error: "Could not upload avatar. Please try again.", code: "INTERNAL_ERROR" },
    }
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId)

  if (updateError) {
    console.error("[profile.uploadAvatar] profile update failed", updateError)
    Sentry.captureException(updateError)
    return {
      ok: false,
      error: {
        error: "Avatar uploaded but profile could not be updated. Please try again.",
        code: "INTERNAL_ERROR",
      },
    }
  }

  return { ok: true, data: publicUrl }
}

export async function deleteAccount(userId: string): Promise<ApiResult<void>> {
  try {
    const serviceClient = createServiceClient()
    const { error } = await serviceClient.auth.admin.deleteUser(userId)

    if (error) {
      console.error("[profile.deleteAccount] failed", error)
      Sentry.captureException(error)
      return {
        ok: false,
        error: { error: "Could not delete your account. Please try again.", code: "INTERNAL_ERROR" },
      }
    }

    return { ok: true, data: undefined }
  } catch (error) {
    console.error("[profile.deleteAccount] unexpected error", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not delete your account. Please try again.", code: "INTERNAL_ERROR" },
    }
  }
}
