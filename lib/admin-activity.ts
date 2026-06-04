import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import type { ApiResult } from "@/lib/types"

// Activity-log reads for the admin section. Service-role; call only from a
// requireAdmin()-gated route handler. The activity-row shape + mapper live here and are
// reused by lib/admin.ts (getUserDetail's recentActivity).

const PAGE_SIZE = 20

export interface AdminActivityRow {
  id: string
  workspaceId: string | null
  actorId: string | null
  impersonatorId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface AdminActivityList {
  activities: AdminActivityRow[]
  page: number
  pageSize: number
}

export interface RawActivityRow {
  id: string
  workspace_id: string | null
  actor_id: string | null
  impersonator_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: unknown
  created_at: string
}

export function mapActivityRow(row: RawActivityRow): AdminActivityRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    impersonatorId: row.impersonator_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: row.created_at,
  }
}

export interface ListActivityInput {
  action?: string
  workspaceId?: string
  page?: number
}

export async function listActivity(input: ListActivityInput = {}): Promise<ApiResult<AdminActivityList>> {
  const supabase = createServiceClient()
  const page = input.page && input.page > 0 ? input.page : 1
  const from = (page - 1) * PAGE_SIZE

  let query = supabase
    .from("activity_log")
    .select("id, workspace_id, actor_id, impersonator_id, action, target_type, target_id, metadata, created_at")
  if (input.action) query = query.eq("action", input.action)
  if (input.workspaceId) query = query.eq("workspace_id", input.workspaceId)

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) {
    console.error("[admin-activity.listActivity] read failed", error)
    Sentry.captureException(error)
    return { ok: false, error: { error: "Could not load activity. Please try again.", code: "INTERNAL_ERROR" } }
  }

  return {
    ok: true,
    data: {
      activities: ((data as RawActivityRow[] | null) ?? []).map(mapActivityRow),
      page,
      pageSize: PAGE_SIZE,
    },
  }
}
