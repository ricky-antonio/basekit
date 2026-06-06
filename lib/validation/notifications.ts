import { z } from "zod"

// Every kind is optional so the action can accept a partial update and merge it
// into the stored preferences. The settings form submits all five, but a partial
// payload (e.g. flipping one toggle) is valid.
export const notificationPreferencesSchema = z
  .object({
    weekly_digest: z.boolean(),
    payment_failed: z.boolean(),
    trial_ending: z.boolean(),
    member_joined: z.boolean(),
    plan_changes: z.boolean(),
  })
  .partial()

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>
