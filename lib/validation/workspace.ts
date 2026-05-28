import { z } from "zod"

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(64, "Workspace name must be 64 characters or fewer")
    .trim(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(48, "Slug must be 48 characters or fewer")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens")
    .trim(),
})

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
