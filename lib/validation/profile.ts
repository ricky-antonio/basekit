import { z } from "zod"

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(64, "Display name must be 64 characters or fewer")
    .trim(),
  avatarUrl: z.string().url("Invalid URL").nullable().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
