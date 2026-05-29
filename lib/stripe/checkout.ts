import * as Sentry from "@sentry/nextjs"
import { stripe } from "@/lib/stripe/client"
import { getOrCreateStripeCustomer } from "@/lib/billing"
import type { ApiResult } from "@/lib/types"

interface CreateCheckoutParams {
  workspaceId: string
  priceId: string
  userEmail: string
}

// Creates a Stripe Checkout session for a subscription. workspaceId is stamped on
// both the session and the subscription metadata so the webhook can map the event
// back to the workspace regardless of which event arrives first.
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<ApiResult<string>> {
  const { workspaceId, priceId, userEmail } = params
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"

  const customerResult = await getOrCreateStripeCustomer({ workspaceId, email: userEmail })
  if (!customerResult.ok) return customerResult

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerResult.data,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/settings/billing?upgraded=true`,
      cancel_url: `${siteUrl}/settings/billing`,
      allow_promotion_codes: true,
      metadata: { workspaceId },
      subscription_data: { metadata: { workspaceId } },
    })

    if (!session.url) {
      return {
        ok: false,
        error: { error: "Could not start checkout. Please try again.", code: "STRIPE_ERROR" },
      }
    }

    return { ok: true, data: session.url }
  } catch (error) {
    console.error("[stripe.checkout] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not start checkout. Please try again.", code: "STRIPE_ERROR" },
    }
  }
}
