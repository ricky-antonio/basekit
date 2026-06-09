import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { checkRateLimit } from "@/lib/ratelimit"
import { getUserDetail, overrideUserPlan } from "@/lib/admin"
import { isDemoEmail } from "@/lib/demo"
import { planOverrideSchema } from "@/lib/validation/admin"
import { zodFieldErrors } from "@/lib/validation/errors"
import { statusForCode } from "@/lib/http"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const authResult = await requireAdmin()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: statusForCode(authResult.error.code) })
  }

  const rl = await checkRateLimit("adminRead", authResult.data.id)
  if (!rl.success) return NextResponse.json(rl.error, { status: 429 })

  const { id } = await context.params
  const result = await getUserDetail(id, isDemoEmail(authResult.data.email))
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }
  return NextResponse.json(result.data, { status: 200 })
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const authResult = await requireAdmin()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: statusForCode(authResult.error.code) })
  }

  const rl = await checkRateLimit("adminWrite", authResult.data.id)
  if (!rl.success) return NextResponse.json(rl.error, { status: 429 })

  const body: unknown = await request.json().catch(() => null)
  const parsed = planOverrideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors: zodFieldErrors(parsed.error.flatten()) },
      { status: 400 },
    )
  }

  const { id } = await context.params
  const result = await overrideUserPlan({
    admin: authResult.data,
    userId: id,
    plan: parsed.data.plan,
    reason: parsed.data.reason,
  })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: statusForCode(result.error.code) })
  }
  return NextResponse.json(result.data, { status: 200 })
}
