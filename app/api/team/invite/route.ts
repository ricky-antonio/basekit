import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { inviteMember } from "@/lib/invitations"
import { checkRateLimit } from "@/lib/ratelimit"
import { inviteSchema } from "@/lib/validation/team"
import { zodFieldErrors } from "@/lib/validation/errors"
import { statusForCode } from "@/lib/http"

export async function POST(request: Request): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  const rl = await checkRateLimit("teamInvite", workspaceResult.data.id)
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
      { status: 400 },
    )
  }

  const result = await inviteMember({
    workspaceId: workspaceResult.data.id,
    workspaceName: workspaceResult.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: authResult.data.id,
    inviterEmail: authResult.data.email ?? null,
  })

  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }

  return NextResponse.json({ invitation: result.data }, { status: 200 })
}
