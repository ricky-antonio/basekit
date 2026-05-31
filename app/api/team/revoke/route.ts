import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { revokeInvitation } from "@/lib/invitations"
import { checkRateLimit } from "@/lib/ratelimit"
import { revokeSchema } from "@/lib/validation/team"
import { zodFieldErrors } from "@/lib/validation/errors"
import { statusForCode } from "@/lib/http"

export async function DELETE(request: Request): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  const rl = await checkRateLimit("teamRevoke", workspaceResult.data.id)
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = revokeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
      { status: 400 },
    )
  }

  const result = await revokeInvitation({
    workspaceId: workspaceResult.data.id,
    invitationId: parsed.data.invitationId,
    actorId: authResult.data.id,
  })

  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }

  return NextResponse.json({ ok: true })
}
