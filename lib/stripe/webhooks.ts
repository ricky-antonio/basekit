import type Stripe from "stripe"
import { stripe } from "@/lib/stripe/client"
import { createServiceClient } from "@/lib/supabase/server"
import { logActivity } from "@/lib/activity"
import { getWorkspaceOwnerContact } from "@/lib/workspace"
import { sendTrialEndingEmail, sendPaymentFailedEmail } from "@/lib/email"
import {
  checkoutSessionSchema,
  subscriptionEventSchema,
  invoiceEventSchema,
} from "@/lib/validation/billing"
import {
  BILLING_URL,
  buildSubscriptionFields,
  formatDate,
  isRecognizedPaidPrice,
  refToId,
  resolveWorkspaceId,
  skip,
  toIso,
  writeSubscription,
  type ServiceClient,
} from "@/lib/stripe/webhook-helpers"

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 }

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
  const checkoutItem = subParsed.data.items.data[0]
  if (!checkoutItem) {
    return skip("checkout.session.completed (no line item)", { subscriptionId })
  }
  if (!isRecognizedPaidPrice(checkoutItem.price.id)) {
    return skip("checkout.session.completed (unrecognized price; refusing to downgrade)", {
      subscriptionId,
      priceId: checkoutItem.price.id,
    })
  }

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
  const changeItem = subscription.items.data[0]
  if (!changeItem) {
    return skip("customer.subscription.updated (no line item)", { id: subscription.id })
  }
  if (!isRecognizedPaidPrice(changeItem.price.id)) {
    return skip("customer.subscription.updated (unrecognized price; refusing to downgrade)", {
      id: subscription.id,
      priceId: changeItem.price.id,
    })
  }

  const workspaceId = await resolveWorkspaceId(
    supabase,
    subscription.metadata?.["workspaceId"],
    refToId(subscription.customer),
  )
  if (!workspaceId) return skip("customer.subscription.updated (no workspace)", { id: subscription.id })

  // Read the prior plan so a portal-initiated tier switch can be logged. The
  // initial free→paid purchase is logged by checkout.session.completed; here we
  // only log switches *between paid tiers*, which avoids double-logging the
  // purchase when the created/updated events race the checkout event.
  const { data: previous } = await supabase
    .from("subscriptions")
    .select("plan_name")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  const fields = buildSubscriptionFields(subscription)
  await writeSubscription(supabase, workspaceId, fields)

  const previousPlan = previous?.plan_name ?? "free"
  if (previousPlan !== fields.plan_name && previousPlan !== "free" && fields.plan_name !== "free") {
    const action =
      (PLAN_RANK[fields.plan_name] ?? 0) > (PLAN_RANK[previousPlan] ?? 0)
        ? "subscription.upgraded"
        : "subscription.downgraded"
    await logActivity({
      workspaceId,
      actorId: null,
      action,
      targetType: "subscription",
      targetId: subscription.id,
      metadata: { from: previousPlan, to: fields.plan_name },
    })
  }
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

  const contact = await getWorkspaceOwnerContact(workspaceId)
  if (!contact.ok) return skip("customer.subscription.trial_will_end (no owner contact)", { workspaceId })

  await sendTrialEndingEmail({
    to: contact.data.email,
    workspaceName: contact.data.workspaceName,
    trialEndDate: formatDate(toIso(subscription.trial_end)),
    portalUrl: BILLING_URL,
  })
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

  const contact = await getWorkspaceOwnerContact(workspaceId)
  if (!contact.ok) return skip("invoice.payment_failed (no owner contact)", { workspaceId })

  await sendPaymentFailedEmail({
    to: contact.data.email,
    workspaceName: contact.data.workspaceName,
    portalUrl: BILLING_URL,
  })
}

async function handleInvoicePaymentSucceeded(supabase: ServiceClient, raw: unknown): Promise<void> {
  const parsed = invoiceEventSchema.safeParse(raw)
  if (!parsed.success) return skip("invoice.payment_succeeded (parse)", parsed.error.issues)

  const workspaceId = await resolveWorkspaceId(supabase, undefined, refToId(parsed.data.customer))
  if (!workspaceId) return skip("invoice.payment_succeeded (no workspace)", {})

  // The subscription's current period end is the furthest line-period end on the invoice
  // (the top-level invoice period is zero-length on the first invoice — Stripe gotcha).
  const lineEnds = (parsed.data.lines?.data ?? [])
    .map((line) => line.period?.end)
    .filter((end): end is number => typeof end === "number")
  const periodEnd = lineEnds.length ? toIso(Math.max(...lineEnds)) : null
  if (!periodEnd) return

  // Only refresh the billing period. Status transitions (past_due → active on
  // recovery, trialing, etc.) are owned by customer.subscription.* events — the
  // source of truth — so an invoice event can't stomp a 'trialing' status here.
  const { error } = await supabase
    .from("subscriptions")
    .update({ current_period_end: periodEnd })
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
