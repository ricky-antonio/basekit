import { NextResponse } from "next/server"
import type Stripe from "stripe"
import * as Sentry from "@sentry/nextjs"
import { stripe } from "@/lib/stripe/client"
import { createServiceClient } from "@/lib/supabase/server"
import { handleStripeEvent } from "@/lib/stripe/webhooks"
import { checkRateLimit } from "@/lib/ratelimit"

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const rateLimit = await checkRateLimit("webhookStripe", ip)
  if (!rateLimit.success) {
    return NextResponse.json(rateLimit.error, { status: 429 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature.", code: "VALIDATION_ERROR" },
      { status: 400 },
    )
  }

  const body = await request.text()
  const secret = process.env["STRIPE_WEBHOOK_SECRET"]!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (error) {
    console.warn("[webhook.stripe] invalid signature", error)
    return NextResponse.json(
      { error: "Invalid signature.", code: "VALIDATION_ERROR" },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  // Idempotency: Stripe retries deliver the same event.id. A row in stripe_events
  // means we've already processed it — short-circuit so we never double-apply.
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle()

  if (existing) {
    console.info(`[webhook.stripe] duplicate ${event.id} ${event.type}`)
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
  }

  try {
    await handleStripeEvent(event)

    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({ id: event.id, type: event.type })
    if (insertError) {
      console.error("[webhook.stripe] failed to record event", event.id, insertError)
      Sentry.captureException(insertError, { extra: { eventId: event.id, eventType: event.type } })
    }

    console.info(`[webhook.stripe] processed ${event.id} ${event.type}`)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    // Return 200 even on failure so Stripe doesn't retry-storm. Sentry is how we
    // find out; the event is NOT recorded, leaving it replayable from the dashboard.
    console.error("[webhook.stripe] handler failed", event.id, event.type, error)
    Sentry.captureException(error, { extra: { eventId: event.id, eventType: event.type } })
    return NextResponse.json({ received: true, error: "processing_failed" }, { status: 200 })
  }
}
