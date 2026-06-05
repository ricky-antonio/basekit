import { NextResponse } from "next/server"
import { endImpersonation } from "@/lib/impersonation"
import { logActivity } from "@/lib/activity"

// Ending impersonation needs no requireAdmin: getUser() would resolve to the target
// (a non-admin) while the session is active, which would dead-lock the exit. The signed
// httpOnly cookie is itself the proof — clearing it is always safe and idempotent.
export async function POST(): Promise<Response> {
  const context = await endImpersonation()

  if (context) {
    await logActivity({
      workspaceId: null,
      actorId: context.adminId,
      impersonatorId: context.adminId,
      action: "admin.impersonation_ended",
      targetType: "user",
      targetId: context.targetUserId,
      metadata: { targetEmail: context.targetEmail },
    })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
