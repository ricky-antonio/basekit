import * as Sentry from "@sentry/nextjs"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { ApiResult } from "@/lib/types"
import {
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/types"
import type { Json } from "@/lib/database.types"
import type { NotificationPreferencesInput } from "@/lib/validation/notifications"

// Opt-out model: every notification is on until the user disables it. A missing or
// malformed stored value falls back to all-on so a corrupt jsonb never silently
// suppresses a billing notice.
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  weekly_digest: true,
  payment_failed: true,
  trial_ending: true,
  member_joined: true,
  plan_changes: true,
}

function mergeStoredPreferences(raw: Json | null | undefined): NotificationPreferences {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, Json | undefined>)
      : {}
  const result = { ...DEFAULT_NOTIFICATION_PREFERENCES }
  for (const kind of NOTIFICATION_KINDS) {
    if (typeof stored[kind] === "boolean") result[kind] = stored[kind] as boolean
  }
  return result
}

export async function getNotificationPreferences(
  userId: string,
): Promise<ApiResult<NotificationPreferences>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .single()

  if (error || !data) {
    console.error("[notifications.get] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not load notification preferences.", code: "NOT_FOUND" },
    }
  }

  return { ok: true, data: mergeStoredPreferences(data.notification_preferences) }
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: NotificationPreferencesInput,
): Promise<ApiResult<NotificationPreferences>> {
  const current = await getNotificationPreferences(userId)
  if (!current.ok) return current

  const merged: NotificationPreferences = { ...current.data, ...prefs }

  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: merged })
    .eq("id", userId)

  if (error) {
    console.error("[notifications.update] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: {
        error: "Could not save notification preferences. Please try again.",
        code: "INTERNAL_ERROR",
      },
    }
  }

  return { ok: true, data: merged }
}

// Called from server-only send paths (the Stripe webhook). Reads via the service
// client because there is no user session in that context. Fails OPEN (returns true)
// on any read error — a transient DB issue must never silently drop a payment notice.
export async function shouldSendNotification(
  userId: string,
  kind: NotificationKind,
): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single()

    if (error || !data) {
      Sentry.captureException(error ?? new Error("notification preferences not found"))
      return true
    }

    return mergeStoredPreferences(data.notification_preferences)[kind]
  } catch (error) {
    console.error("[notifications.shouldSend] threw", error)
    Sentry.captureException(error)
    return true
  }
}
