import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { checkRateLimit } from "@/lib/ratelimit"
import { listUsers } from "@/lib/admin"
import { isDemoEmail } from "@/lib/demo"
import { adminUserListSchema } from "@/lib/validation/admin"
import { zodFieldErrors } from "@/lib/validation/errors"
import { statusForCode } from "@/lib/http"

export async function GET(request: Request): Promise<Response> {
  const authResult = await requireAdmin()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: statusForCode(authResult.error.code) })
  }

  const rl = await checkRateLimit("adminRead", authResult.data.id)
  if (!rl.success) return NextResponse.json(rl.error, { status: 429 })

  const { searchParams } = new URL(request.url)
  const parsed = adminUserListSchema.safeParse({
    search: searchParams.get("search") || undefined,
    plan: searchParams.get("plan") || undefined,
    status: searchParams.get("status") || undefined,
    page: searchParams.get("page") || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
      { status: 400 },
    )
  }

  const result = await listUsers({ ...parsed.data, demoOnly: isDemoEmail(authResult.data.email) })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }
  return NextResponse.json(result.data, { status: 200 })
}
