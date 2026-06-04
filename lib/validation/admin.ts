import { z } from "zod"

export const planNameSchema = z.enum(["free", "pro", "enterprise"])

export const subscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
])

// Query params for the admin user list. All optional — an empty query lists the
// first page unfiltered. `page` is coerced from the string a URL always carries.
export const adminUserListSchema = z.object({
  search: z.string().trim().min(1).optional(),
  plan: planNameSchema.optional(),
  status: subscriptionStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
})

// Body for a manual plan override. A reason is mandatory — the override is audited
// and a why-string is what makes the activity_log row useful after the fact.
export const planOverrideSchema = z.object({
  plan: planNameSchema,
  reason: z.string().trim().min(1, "A reason is required").max(500, "Reason is too long"),
})

// Query params for the admin activity log.
export const adminActivitySchema = z.object({
  action: z.string().trim().min(1).optional(),
  workspaceId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export type AdminUserListInput = z.infer<typeof adminUserListSchema>
export type PlanOverrideInput = z.infer<typeof planOverrideSchema>
export type AdminActivityInput = z.infer<typeof adminActivitySchema>
