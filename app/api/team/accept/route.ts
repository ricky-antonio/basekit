import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { acceptInvitation } from "@/lib/invitations"
import { checkRateLimit } from "@/lib/ratelimit"
import { acceptSchema } from "@/lib/validation/team"
import { zodFieldErrors } from "@/lib/validation/errors"
import { statusForCode } from "@/lib/http"

function ipFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: Request): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const rl = await checkRateLimit("teamAccept", ipFromRequest(request))
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = acceptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
      { status: 400 },
    )
  }

  const result = await acceptInvitation({ token: parsed.data.token, userId: authResult.data.id })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }

  return NextResponse.json({ workspaceId: result.data.workspaceId, role: result.data.role })
}
