import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  mockSupabase,
  mockSupabaseFrom,
  getLastWrite,
  resetSupabaseMock,
} from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

const captureException = vi.fn()
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  shouldSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notifications"

const userId = "user-123"

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("getNotificationPreferences", () => {
  it("returns defaults (all on) when none set", async () => {
    mockSupabaseFrom("profiles", { data: { notification_preferences: {} }, error: null })

    const result = await getNotificationPreferences(userId)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
  })

  it("overlays stored values onto the defaults", async () => {
    mockSupabaseFrom("profiles", {
      data: { notification_preferences: { weekly_digest: false, payment_failed: false } },
      error: null,
    })

    const result = await getNotificationPreferences(userId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.weekly_digest).toBe(false)
      expect(result.data.payment_failed).toBe(false)
      expect(result.data.trial_ending).toBe(true)
    }
  })

  it("ignores a malformed (non-object) stored value and falls back to defaults", async () => {
    mockSupabaseFrom("profiles", { data: { notification_preferences: "garbage" }, error: null })

    const result = await getNotificationPreferences(userId)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
  })

  it("returns NOT_FOUND and reports to Sentry on a read error", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "boom" } })

    const result = await getNotificationPreferences(userId)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
    expect(captureException).toHaveBeenCalled()
  })
})

describe("updateNotificationPreferences", () => {
  it("merges the partial update into the existing preferences", async () => {
    mockSupabaseFrom("profiles", {
      data: { notification_preferences: { weekly_digest: false } },
      error: null,
    })

    const result = await updateNotificationPreferences(userId, { payment_failed: false })

    expect(result.ok).toBe(true)
    const write = getLastWrite("profiles", "update")
    expect(write?.payload).toEqual({
      notification_preferences: {
        weekly_digest: false,
        payment_failed: false,
        trial_ending: true,
        member_joined: true,
        plan_changes: true,
      },
    })
    if (result.ok) expect(result.data.weekly_digest).toBe(false)
  })

  it("propagates a read failure instead of writing", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "no profile" } })

    const result = await updateNotificationPreferences(userId, { weekly_digest: false })

    expect(result.ok).toBe(false)
    expect(getLastWrite("profiles", "update")).toBeUndefined()
  })
})

describe("shouldSendNotification", () => {
  it("respects a disabled preference", async () => {
    mockSupabaseFrom("profiles", {
      data: { notification_preferences: { weekly_digest: false } },
      error: null,
    })

    expect(await shouldSendNotification(userId, "weekly_digest")).toBe(false)
  })

  it("returns true when the preference is enabled (default)", async () => {
    mockSupabaseFrom("profiles", { data: { notification_preferences: {} }, error: null })

    expect(await shouldSendNotification(userId, "payment_failed")).toBe(true)
  })

  it("fails open (returns true) when the read errors", async () => {
    mockSupabaseFrom("profiles", { data: null, error: { message: "db down" } })

    expect(await shouldSendNotification(userId, "payment_failed")).toBe(true)
    expect(captureException).toHaveBeenCalled()
  })
})
