import * as Sentry from "@sentry/nextjs"
import { stripe } from "@/lib/stripe/client"
import type { ApiResult } from "@/lib/types"

interface CreatePortalParams {
  customerId: string
  returnUrl: string
}

// Opens a Stripe Customer Portal session for managing/cancelling a subscription.
export async function createPortalSession(
  params: CreatePortalParams,
): Promise<ApiResult<string>> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    })

    if (!session.url) {
      return {
        ok: false,
        error: { error: "Could not open the billing portal. Please try again.", code: "STRIPE_ERROR" },
      }
    }

    return { ok: true, data: session.url }
  } catch (error) {
    console.error("[stripe.portal] failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not open the billing portal. Please try again.", code: "STRIPE_ERROR" },
    }
  }
}
