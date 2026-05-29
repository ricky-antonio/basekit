import type Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import { stripe } from "@/lib/stripe/client"
import { createServiceClient } from "@/lib/supabase/server"
import { getPlanNameFromPriceId } from "@/lib/billing"
import { logActivity } from "@/lib/activity"
import { sendTrialEndingEmail, sendPaymentFailedEmail } from "@/lib/email"
import {
  checkoutSessionSchema,
  subscriptionEventSchema,
  invoiceEventSchema,
  type SubscriptionPayload,
} from "@/lib/validation/billing"
import type { SubscriptionStatus } from "@/lib/types"

type ServiceClient = ReturnType<typeof createServiceClient>

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

function toIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null) return null
  return new Date(unixSeconds * 1000).toISOString()
}

function refToId(ref: string | { id: string } | null | undefined): string | null {
  if (ref == null) return null
  return typeof ref === "string" ? ref : ref.id
}

// Event slices we can't act on (no workspace, unparseable payload) are logged and
// skipped — never thrown — so the webhook always settles to a 200.
function skip(context: string, detail: unknown): void {
  console.warn(`[webhook.stripe] ${context} skipped`, detail)
  Sentry.captureMessage(`[webhook.stripe] ${context} skipped`, {
    level: "warning",
    extra: { detail: JSON.stringify(detail) },
  })
}

// Resolve the workspace for an event: prefer the workspaceId we stamp into Stripe
// metadata; fall back to a lookup by the customer ID we persisted at checkout.
async function resolveWorkspaceId(
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

function buildSubscriptionFields(subscription: SubscriptionPayload) {
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

async function writeSubscription(
  supabase: ServiceClient,
  workspaceId: string,
  fields: ReturnType<typeof buildSubscriptionFields>,
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ workspace_id: workspaceId, ...fields }, { onConflict: "workspace_id" })
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`)
}

async function handleCheckoutCompleted(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = checkoutSessionSchema.safeParse(raw)
  if (!parsed.success) return skip("checkout.session.completed (parse)", parsed.error.issues)

  const session = parsed.data
  const customerId = refToId(session.customer)
  const subscriptionId = refToId(session.subscription)
  const workspaceId = await resolveWorkspaceId(supabase, session.metadata?.["workspaceId"], customerId)

  if (!workspaceId || !subscriptionId) {
    return skip("checkout.session.completed (no workspace/subscription)", { workspaceId, subscriptionId })
  }

  const rawSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const subParsed = subscriptionEventSchema.safeParse(rawSubscription)
  if (!subParsed.success) return skip("checkout.session.completed (subscription parse)", subParsed.error.issues)

  const fields = buildSubscriptionFields(subParsed.data)
  await writeSubscription(supabase, workspaceId, fields)
  await logActivity({
    workspaceId,
    actorId: null,
    action: "subscription.upgraded",
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: { plan: fields.plan_name },
  })
}

async function handleSubscriptionChange(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = subscriptionEventSchema.safeParse(raw)
  if (!parsed.success) return skip("customer.subscription.updated (parse)", parsed.error.issues)

  const subscription = parsed.data
  const workspaceId = await resolveWorkspaceId(
    supabase,
    subscription.metadata?.["workspaceId"],
    refToId(subscription.customer),
  )
  if (!workspaceId) return skip("customer.subscription.updated (no workspace)", { id: subscription.id })

  await writeSubscription(supabase, workspaceId, buildSubscriptionFields(subscription))
}

async function handleSubscriptionDeleted(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = subscriptionEventSchema.safeParse(raw)
  if (!parsed.success) return skip("customer.subscription.deleted (parse)", parsed.error.issues)

  const subscription = parsed.data
  const workspaceId = await resolveWorkspaceId(
    supabase,
    subscription.metadata?.["workspaceId"],
    refToId(subscription.customer),
  )
  if (!workspaceId) return skip("customer.subscription.deleted (no workspace)", { id: subscription.id })

  const { error } = await supabase
    .from("subscriptions")
    .update({
      plan_name: "free",
      status: "canceled",
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      stripe_price_id: null,
      trial_end: null,
    })
    .eq("workspace_id", workspaceId)
  if (error) throw new Error(`subscriptions downgrade failed: ${error.message}`)

  await logActivity({
    workspaceId,
    actorId: null,
    action: "subscription.canceled",
    targetType: "subscription",
    targetId: subscription.id,
  })
}

async function handleTrialWillEnd(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = subscriptionEventSchema.safeParse(raw)
  if (!parsed.success) return skip("customer.subscription.trial_will_end (parse)", parsed.error.issues)

  const subscription = parsed.data
  const workspaceId = await resolveWorkspaceId(
    supabase,
    subscription.metadata?.["workspaceId"],
    refToId(subscription.customer),
  )
  if (!workspaceId) return skip("customer.subscription.trial_will_end (no workspace)", { id: subscription.id })

  await sendTrialEndingEmail({ workspaceId, trialEnd: toIso(subscription.trial_end) })
}

async function handleInvoicePaymentFailed(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = invoiceEventSchema.safeParse(raw)
  if (!parsed.success) return skip("invoice.payment_failed (parse)", parsed.error.issues)

  const workspaceId = await resolveWorkspaceId(supabase, undefined, refToId(parsed.data.customer))
  if (!workspaceId) return skip("invoice.payment_failed (no workspace)", {})

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("workspace_id", workspaceId)
  if (error) throw new Error(`subscriptions past_due failed: ${error.message}`)

  await sendPaymentFailedEmail({ workspaceId })
}

async function handleInvoicePaymentSucceeded(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = invoiceEventSchema.safeParse(raw)
  if (!parsed.success) return skip("invoice.payment_succeeded (parse)", parsed.error.issues)

  const workspaceId = await resolveWorkspaceId(supabase, undefined, refToId(parsed.data.customer))
  if (!workspaceId) return skip("invoice.payment_succeeded (no workspace)", {})

  const periodEnd = toIso(parsed.data.period_end)
  const update: { status: SubscriptionStatus; current_period_end?: string } = { status: "active" }
  if (periodEnd) update.current_period_end = periodEnd

  const { error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("workspace_id", workspaceId)
  if (error) throw new Error(`subscriptions period update failed: ${error.message}`)
}

// Dispatches a verified Stripe event to the right handler. Throws on genuine
// failures (DB write errors) so the route can Sentry-capture; unactionable events
// are skipped gracefully inside the handlers.
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const supabase = createServiceClient()

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(supabase, event.data.object)
      break
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionChange(supabase, event.data.object)
      break
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(supabase, event.data.object)
      break
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(supabase, event.data.object)
      break
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(supabase, event.data.object)
      break
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(supabase, event.data.object)
      break
    default:
      console.info(`[webhook.stripe] ignoring unhandled event type ${event.type}`)
      break
  }
}
