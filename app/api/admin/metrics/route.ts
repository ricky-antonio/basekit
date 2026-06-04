import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { checkRateLimit } from "@/lib/ratelimit"
import { getMetrics } from "@/lib/admin-metrics"
import { statusForCode } from "@/lib/http"

// Always evaluated per-request: requireAdmin reads the session cookie, so this route
// can't be statically cached. Metric freshness is fine at request granularity for the
// admin dashboard; client-side polling/refetch is the lever if it ever needs to be live.
export async function GET(): Promise<Response> {
  const authResult = await requireAdmin()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: statusForCode(authResult.error.code) })
  }

  const rl = await checkRateLimit("adminRead", authResult.data.id)
  if (!rl.success) return NextResponse.json(rl.error, { status: 429 })

  const result = await getMetrics()
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }
  return NextResponse.json(result.data, { status: 200 })
}
