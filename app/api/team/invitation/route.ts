import { NextResponse } from "next/server"
import { getInvitationByToken } from "@/lib/invitations"
import { checkRateLimit } from "@/lib/ratelimit"

function ipFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
}

// Public, unauthenticated invitation preview for the /team/accept page. The token is
// the secret; a holder may see who invited them and to which workspace. Rate-limited
// by IP because it takes a guessable-shaped token and is reachable without a session.
// Always 200 with a status discriminant — the lookup succeeding is not gated on the
// invitation being valid (the page renders valid / expired / accepted / not_found).
export async function GET(request: Request): Promise<Response> {
  const rl = await checkRateLimit("teamInviteLookup", ipFromRequest(request))
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const token = new URL(request.url).searchParams.get("token")
  if (!token) {
    return NextResponse.json(
      { error: "Missing invitation token.", code: "VALIDATION_ERROR" },
      { status: 400 },
    )
  }

  const preview = await getInvitationByToken(token)
  return NextResponse.json(preview)
}
