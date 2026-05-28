import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/database.types"

interface LogActivityParams {
  workspaceId: string | null
  actorId: string | null
  impersonatorId?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    workspaceId,
    actorId,
    impersonatorId = null,
    action,
    targetType = null,
    targetId = null,
    metadata = {},
  } = params

  const supabase = createServiceClient()

  const { error } = await supabase.from("activity_log").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    impersonator_id: impersonatorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as Json,
  })

  if (error) {
    // Activity logging is best-effort — never block a flow on log failure
    console.error("[activity] failed to log action", action, error)
    Sentry.captureException(error, { extra: { action, workspaceId } })
  }
}
