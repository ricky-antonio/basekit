import { z } from "zod"

// Mirrors the projects table CHECK constraints: name char_length 1–64,
// description nullable or ≤ 500. An empty description coerces to null so the
// column stays NULL rather than an empty string.
export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(64, "Project name must be 64 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
