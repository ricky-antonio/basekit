// Branded ID types — prevent mixing up IDs that are all `string` under the hood
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" }
export type UserId = string & { readonly __brand: "UserId" }
export type ProjectId = string & { readonly __brand: "ProjectId" }
export type InvitationId = string & { readonly __brand: "InvitationId" }

// Narrow an arbitrary string to a branded type at a trust boundary
export function asWorkspaceId(id: string): WorkspaceId {
  return id as WorkspaceId
}
export function asUserId(id: string): UserId {
  return id as UserId
}
export function asProjectId(id: string): ProjectId {
  return id as ProjectId
}

// ------------------------------------------------------------------ //
// Error shape                                                          //
// ------------------------------------------------------------------ //

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "STRIPE_ERROR"
  | "INTERNAL_ERROR"

export interface ApiError {
  error: string
  code: ApiErrorCode
  upgradeUrl?: string
  fieldErrors?: Record<string, string>
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

// ------------------------------------------------------------------ //
// Domain types                                                         //
// ------------------------------------------------------------------ //

export type PlanName = "free" | "pro" | "enterprise"

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid"

export type WorkspaceMemberRole = "owner" | "admin" | "member"

export type UserRole = "user" | "admin"

export type UsageResource = "projects" | "members"

// ------------------------------------------------------------------ //
// Exhaustive-switch helper                                             //
// ------------------------------------------------------------------ //

export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`)
}
