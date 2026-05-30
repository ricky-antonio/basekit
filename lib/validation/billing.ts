import { z } from "zod"
import { PLANS } from "@/lib/plans"

// The set of price IDs we actually sell. Built from PLANS so it stays in sync with
// the single source of truth (and reflects the configured env values at call time).
function configuredPriceIds(): Set<string> {
  const ids = new Set<string>()
  for (const plan of Object.values(PLANS)) {
    if (plan.monthlyPriceId) ids.add(plan.monthlyPriceId)
    if (plan.annualPriceId) ids.add(plan.annualPriceId)
  }
  return ids
}

// ------------------------------------------------------------------ //
// API request bodies                                                   //
// ------------------------------------------------------------------ //

export const checkoutBodySchema = z.object({
  priceId: z
    .string()
    .min(1, "A plan is required.")
    .refine((id) => configuredPriceIds().has(id), { message: "Unknown plan selected." }),
})

export const portalBodySchema = z.object({
  returnPath: z.string().startsWith("/", "Return path must be relative.").optional(),
})

export const cancelBodySchema = z.object({})

export type CheckoutBody = z.infer<typeof checkoutBodySchema>
export type PortalBody = z.infer<typeof portalBodySchema>
export type CancelBody = z.infer<typeof cancelBodySchema>

// ------------------------------------------------------------------ //
// Webhook payload extraction schemas                                   //
//                                                                      //
// Stripe payloads are signature-verified first, then parsed here to    //
// narrow the exact slice each handler reads. Stripe "id or expanded     //
// object" fields are accepted as either.                               //
// ------------------------------------------------------------------ //

const idRef = z.union([z.string(), z.object({ id: z.string() })])

export const checkoutSessionSchema = z.object({
  metadata: z.record(z.string(), z.string()).nullish(),
  customer: idRef.nullish(),
  subscription: idRef.nullish(),
})

export const subscriptionEventSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer: idRef.nullish(),
  cancel_at_period_end: z.boolean().default(false),
  trial_end: z.number().nullish(),
  metadata: z.record(z.string(), z.string()).nullish(),
  items: z.object({
    data: z.array(
      z.object({
        price: z.object({ id: z.string() }),
        current_period_start: z.number().nullish(),
        current_period_end: z.number().nullish(),
      }),
    ),
  }),
})

// Read the billing period from the invoice LINE period, not the invoice's top-level
// `period_end`: for a subscription's first invoice the top-level period is zero-length
// (start == end == creation time), whereas the line period reflects the real billing
// window. Multiple lines (proration) can appear, so the handler takes the furthest end.
export const invoiceEventSchema = z.object({
  customer: idRef.nullish(),
  lines: z
    .object({
      data: z.array(z.object({ period: z.object({ end: z.number().nullish() }).nullish() })),
    })
    .nullish(),
})

export type CheckoutSessionPayload = z.infer<typeof checkoutSessionSchema>
export type SubscriptionPayload = z.infer<typeof subscriptionEventSchema>
export type InvoicePayload = z.infer<typeof invoiceEventSchema>
