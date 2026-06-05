import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { checkRateLimit } from "@/lib/ratelimit"
import { startImpersonation } from "@/lib/impersonation"
import { logActivity } from "@/lib/activity"
import { statusForCode } from "@/lib/http"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const authResult = await requireAdmin()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: statusForCode(authResult.error.code) })
  }

  const rl = await checkRateLimit("impersonate", authResult.data.id)
  if (!rl.success) return NextResponse.json(rl.error, { status: 429 })

  const { id } = await context.params
  const result = await startImpersonation({ admin: authResult.data, targetUserId: id })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }

  await logActivity({
    workspaceId: null,
    actorId: authResult.data.id,
    impersonatorId: authResult.data.id,
    action: "admin.impersonation_started",
    targetType: "user",
    targetId: id,
    metadata: { targetEmail: result.data.targetEmail },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
