import { z } from "zod"

// Invite roles are a subset of workspace_members.role — you can invite an admin or a
// member, never an owner (ownership is established at workspace creation).
export const inviteRoleSchema = z.enum(["admin", "member"])

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  role: inviteRoleSchema.default("member"),
})

export const acceptSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
})

export const removeMemberSchema = z.object({
  memberUserId: z.string().uuid("Invalid member id"),
})

export const changeRoleSchema = z.object({
  memberUserId: z.string().uuid("Invalid member id"),
  role: inviteRoleSchema,
})

export const revokeSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation id"),
})

export type InviteInput = z.infer<typeof inviteSchema>
export type AcceptInput = z.infer<typeof acceptSchema>
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>
export type RevokeInput = z.infer<typeof revokeSchema>
