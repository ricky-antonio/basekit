import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getWorkspaceSubscription } from "@/lib/billing"
import { createPortalSession } from "@/lib/stripe/portal"
import { checkRateLimit } from "@/lib/ratelimit"
import { portalBodySchema } from "@/lib/validation/billing"

export async function POST(request: Request): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const rl = await checkRateLimit("billingPortal", authResult.data.id)
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  const body: unknown = await request.json().catch(() => ({}))
  const parsed = portalBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR" },
      { status: 400 },
    )
  }

  const subscriptionResult = await getWorkspaceSubscription(workspaceResult.data.id)
  if (!subscriptionResult.ok || !subscriptionResult.data.stripe_customer_id) {
    return NextResponse.json(
      {
        error: "No billing account found. Start a subscription first.",
        code: "NOT_FOUND",
      },
      { status: 400 },
    )
  }

  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"
  const returnPath = parsed.data.returnPath ?? "/settings/billing"
  const returnUrl = `${siteUrl}${returnPath}`

  const result = await createPortalSession({
    customerId: subscriptionResult.data.stripe_customer_id,
    returnUrl,
  })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: 500 })
  }

  return NextResponse.json({ url: result.data })
}
