import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { getWorkspaceSubscription } from "@/lib/billing"
import { stripe } from "@/lib/stripe/client"
import { logActivity } from "@/lib/activity"
import { checkRateLimit } from "@/lib/ratelimit"

export async function POST(): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const rl = await checkRateLimit("billingCancel", authResult.data.id)
  if (!rl.success) {
    return NextResponse.json(rl.error, { status: 429 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  // Only the workspace owner may cancel the subscription.
  if (workspaceResult.data.owner_id !== authResult.data.id) {
    return NextResponse.json(
      { error: "Only the workspace owner can cancel the subscription.", code: "FORBIDDEN" },
      { status: 403 },
    )
  }

  const subscriptionResult = await getWorkspaceSubscription(workspaceResult.data.id)
  if (!subscriptionResult.ok || !subscriptionResult.data.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  try {
    await stripe.subscriptions.update(subscriptionResult.data.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  } catch (error) {
    console.error("[billing.cancel] stripe update failed", error)
    Sentry.captureException(error)
    return NextResponse.json(
      { error: "Could not cancel the subscription. Please try again.", code: "STRIPE_ERROR" },
      { status: 500 },
    )
  }

  await logActivity({
    workspaceId: workspaceResult.data.id,
    actorId: authResult.data.id,
    action: "subscription.canceled",
    metadata: {
      stripe_subscription_id: subscriptionResult.data.stripe_subscription_id,
    },
  })

  revalidatePath("/settings/billing")
  return NextResponse.json({ ok: true })
}
