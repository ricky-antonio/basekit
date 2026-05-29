import * as Sentry from "@sentry/nextjs"
import { stripe } from "@/lib/stripe/client"
import { createServiceClient } from "@/lib/supabase/server"
import { getSubscription, type Subscription } from "@/lib/subscription"
import { getPlanFromPriceId } from "@/lib/plans"
import type { ApiResult, PlanName } from "@/lib/types"

// Delegates to the canonical subscription fetch (lib/subscription.ts). Kept as a
// named billing-domain entry point so call sites read in billing terms.
export async function getWorkspaceSubscription(
  workspaceId: string,
): Promise<ApiResult<Subscription>> {
  return getSubscription(workspaceId)
}

// Delegates to the canonical plan-name derivation (lib/plans.ts).
export function getPlanNameFromPriceId(priceId: string): PlanName {
  return getPlanFromPriceId(priceId)
}

function normalizePlanName(planName: string): PlanName {
  return planName === "pro" || planName === "enterprise" ? planName : "free"
}

// Statuses that actually grant plan access. `past_due` is included: Stripe is still
// retrying payment (dunning grace), so we keep access until it cancels. Everything
// else — canceled, incomplete (initial payment never cleared), unpaid (dunning
// exhausted) — means no paid access regardless of the stored plan name.
const ACCESS_GRANTING_STATUSES = new Set(["active", "trialing", "past_due"])

// The plan a workspace effectively has right now. Falls back to 'free' when no
// subscription exists OR when the subscription's status no longer grants access —
// so a half-finished or lapsed subscription can't keep handing out Pro limits.
export async function getActivePlan(workspaceId: string): Promise<PlanName> {
  const result = await getWorkspaceSubscription(workspaceId)
  if (!result.ok) return "free"
  if (!ACCESS_GRANTING_STATUSES.has(result.data.status)) return "free"
  return normalizePlanName(result.data.plan_name)
}

interface GetOrCreateCustomerParams {
  workspaceId: string
  email: string
}

// Returns the workspace's Stripe customer ID, creating + persisting one on first
// use. Service-role only (writes the subscriptions row) — call from route
// handlers / Server Actions, never a Server Component.
export async function getOrCreateStripeCustomer(
  params: GetOrCreateCustomerParams,
): Promise<ApiResult<string>> {
  const { workspaceId, email } = params
  const supabase = createServiceClient()

  const { data: existing, error: readError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (readError) {
    console.error("[billing.getOrCreateStripeCustomer] read failed", readError)
    Sentry.captureException(readError)
    return {
      ok: false,
      error: { error: "Could not load your billing details. Please try again.", code: "INTERNAL_ERROR" },
    }
  }

  if (existing?.stripe_customer_id) {
    return { ok: true, data: existing.stripe_customer_id }
  }

  try {
    const customer = await stripe.customers.create({ email, metadata: { workspaceId } })

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ stripe_customer_id: customer.id })
      .eq("workspace_id", workspaceId)

    if (updateError) {
      console.error("[billing.getOrCreateStripeCustomer] persist failed", updateError)
      Sentry.captureException(updateError)
      return {
        ok: false,
        error: { error: "Could not save your billing profile. Please try again.", code: "INTERNAL_ERROR" },
      }
    }

    return { ok: true, data: customer.id }
  } catch (error) {
    console.error("[billing.getOrCreateStripeCustomer] stripe failed", error)
    Sentry.captureException(error)
    return {
      ok: false,
      error: { error: "Could not start billing. Please try again.", code: "STRIPE_ERROR" },
    }
  }
}
