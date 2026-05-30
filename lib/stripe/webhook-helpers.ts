import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { getPlanNameFromPriceId } from "@/lib/billing"
import type { SubscriptionPayload } from "@/lib/validation/billing"
import type { SubscriptionStatus } from "@/lib/types"

export type ServiceClient = ReturnType<typeof createServiceClient>

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"
export const BILLING_URL = `${SITE_URL}/settings/billing`

const ALLOWED_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
])

// Map Stripe's wider status set onto the six we store. Unknown/paused states map to
// 'canceled' (the safe direction — UI treats them as no longer active).
function normalizeStatus(status: string): SubscriptionStatus {
  if (ALLOWED_STATUSES.has(status as SubscriptionStatus)) return status as SubscriptionStatus
  if (status === "incomplete_expired") return "incomplete"
  return "canceled"
}

export function toIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null) return null
  return new Date(unixSeconds * 1000).toISOString()
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function refToId(ref: string | { id: string } | null | undefined): string | null {
  if (ref == null) return null
  return typeof ref === "string" ? ref : ref.id
}

// Event slices we can't act on (no workspace, unparseable payload) are logged and
// skipped — never thrown — so the webhook always settles to a 200.
export function skip(context: string, detail: unknown): void {
  console.warn(`[webhook.stripe] ${context} skipped`, detail)
  Sentry.captureMessage(`[webhook.stripe] ${context} skipped`, {
    level: "warning",
    extra: { detail: JSON.stringify(detail) },
  })
}

// Resolve the workspace for an event: prefer the workspaceId we stamp into Stripe
// metadata; fall back to a lookup by the customer ID we persisted at checkout.
export async function resolveWorkspaceId(
  supabase: ServiceClient,
  metadataWorkspaceId: string | null | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (metadataWorkspaceId) return metadataWorkspaceId
  if (!customerId) return null
  const { data } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  return data?.workspace_id ?? null
}

export function buildSubscriptionFields(subscription: SubscriptionPayload) {
  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? null
  return {
    plan_name: priceId ? getPlanNameFromPriceId(priceId) : "free",
    status: normalizeStatus(subscription.status),
    stripe_subscription_id: subscription.id,
    stripe_customer_id: refToId(subscription.customer),
    stripe_price_id: priceId,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_start: toIso(item?.current_period_start),
    current_period_end: toIso(item?.current_period_end),
    trial_end: toIso(subscription.trial_end),
  }
}

export async function writeSubscription(
  supabase: ServiceClient,
  workspaceId: string,
  fields: ReturnType<typeof buildSubscriptionFields>,
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ workspace_id: workspaceId, ...fields }, { onConflict: "workspace_id" })
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`)
}

// A subscription whose price doesn't map to a known paid plan is a misconfiguration
// (e.g. a price created in the Stripe dashboard but missing from env). Writing it would
// silently downgrade a paying customer to 'free', so callers skip + alert instead.
export function isRecognizedPaidPrice(priceId: string): boolean {
  return getPlanNameFromPriceId(priceId) !== "free"
}
