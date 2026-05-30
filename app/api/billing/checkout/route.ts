import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getActivePlan } from "@/lib/billing"
import { createCheckoutSession } from "@/lib/stripe/checkout"
import { checkRateLimit } from "@/lib/ratelimit"
import { checkoutBodySchema } from "@/lib/validation/billing"

export async function POST(request: Request): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const rl = await checkRateLimit("billingCheckout", authResult.data.id)
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = issues?.[0] ?? "Invalid"
    }
    return NextResponse.json(
      { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors },
      { status: 400 },
    )
  }

  // Guard: a workspace that already has an active paid subscription must use the
  // Customer Portal to change plans. Creating a second Checkout session would start
  // a second Stripe subscription, doubling the charge.
  const activePlan = await getActivePlan(workspaceResult.data.id)
  if (activePlan !== "free") {
    return NextResponse.json(
      {
        error: "Your workspace already has an active subscription. Use 'Manage billing' to change plans.",
        code: "VALIDATION_ERROR",
      },
      { status: 409 },
    )
  }

  const result = await createCheckoutSession({
    workspaceId: workspaceResult.data.id,
    priceId: parsed.data.priceId,
    userEmail: authResult.data.email ?? "",
  })
  if (!result.ok) {
    return NextResponse.json(result.error, { status: 500 })
  }

  return NextResponse.json({ url: result.data })
}
