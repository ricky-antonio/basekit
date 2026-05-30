import { describe, it, expect, vi, beforeEach } from "vitest"
import type Stripe from "stripe"
import {
  mockSupabase,
  mockSupabaseFrom,
  resetSupabaseMock,
  getLastWrite,
} from "@/tests/mocks/supabase"
import { mockStripe, resetStripeMock } from "@/tests/mocks/stripe"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/stripe/client", () => ({ stripe: mockStripe }))

const mocks = vi.hoisted(() => ({
  logActivity: vi.fn(),
  sendTrialEndingEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  getWorkspaceOwnerContact: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ logActivity: mocks.logActivity }))
vi.mock("@/lib/workspace", () => ({
  getWorkspaceOwnerContact: mocks.getWorkspaceOwnerContact,
}))
vi.mock("@/lib/email", () => ({
  sendTrialEndingEmail: mocks.sendTrialEndingEmail,
  sendPaymentFailedEmail: mocks.sendPaymentFailedEmail,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import { handleStripeEvent } from "@/lib/stripe/webhooks"
import * as Sentry from "@sentry/nextjs"

const workspaceId = "ws-1"

function event(type: string, object: unknown, id = "evt_1"): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event
}

function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { workspaceId },
    items: {
      data: [
        {
          price: { id: "price_pro_monthly_test" },
          current_period_start: 1000,
          current_period_end: 2000,
        },
      ],
    },
    ...overrides,
  }
}

beforeEach(() => {
  resetSupabaseMock()
  resetStripeMock()
  mocks.logActivity.mockReset()
  mocks.sendTrialEndingEmail.mockReset()
  mocks.sendPaymentFailedEmail.mockReset()
  mocks.getWorkspaceOwnerContact.mockReset()
  mockStripe.subscriptions.retrieve.mockReset()
  vi.clearAllMocks()
  mocks.getWorkspaceOwnerContact.mockResolvedValue({
    ok: true,
    data: { email: "owner@example.com", ownerName: "Ada", workspaceName: "Acme" },
  })
})

describe("checkout.session.completed", () => {
  it("upserts the subscription with the correct plan and IDs", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue(subscriptionObject())

    await handleStripeEvent(
      event("checkout.session.completed", {
        metadata: { workspaceId },
        customer: "cus_1",
        subscription: "sub_1",
      }),
    )

    const write = getLastWrite("subscriptions", "upsert")
    expect(write?.options).toEqual({ onConflict: "workspace_id" })
    expect(write?.payload).toMatchObject({
      workspace_id: workspaceId,
      plan_name: "pro",
      status: "active",
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      stripe_price_id: "price_pro_monthly_test",
      current_period_end: new Date(2000 * 1000).toISOString(),
    })
    expect(mocks.logActivity).toHaveBeenCalled()
  })

  it("sets trial_end when the retrieved subscription is trialing", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      subscriptionObject({ status: "trialing", trial_end: 3000 }),
    )

    await handleStripeEvent(
      event("checkout.session.completed", {
        metadata: { workspaceId },
        customer: "cus_1",
        subscription: "sub_1",
      }),
    )

    const write = getLastWrite("subscriptions", "upsert")
    expect(write?.payload).toMatchObject({
      status: "trialing",
      trial_end: new Date(3000 * 1000).toISOString(),
    })
  })
})

describe("customer.subscription.updated", () => {
  it("changes the plan when the price changes", async () => {
    await handleStripeEvent(
      event(
        "customer.subscription.updated",
        subscriptionObject({
          items: {
            data: [{ price: { id: "price_enterprise_monthly_test" }, current_period_start: 1, current_period_end: 2 }],
          },
        }),
      ),
    )

    const write = getLastWrite("subscriptions", "upsert")
    expect(write?.payload).toMatchObject({ plan_name: "enterprise" })
  })

  it("persists cancel_at_period_end", async () => {
    await handleStripeEvent(
      event("customer.subscription.updated", subscriptionObject({ cancel_at_period_end: true })),
    )

    const write = getLastWrite("subscriptions", "upsert")
    expect(write?.payload).toMatchObject({ cancel_at_period_end: true })
  })
})

describe("customer.subscription.deleted", () => {
  it("sets plan to free and status to canceled", async () => {
    await handleStripeEvent(
      event("customer.subscription.deleted", subscriptionObject()),
    )

    const write = getLastWrite("subscriptions", "update")
    expect(write?.payload).toMatchObject({
      plan_name: "free",
      status: "canceled",
      cancel_at_period_end: false,
      stripe_subscription_id: null,
    })
    expect(mocks.logActivity).toHaveBeenCalled()
  })
})

describe("invoice.payment_failed", () => {
  it("sets status to past_due and sends the payment-failed email", async () => {
    mockSupabaseFrom("subscriptions", { data: { workspace_id: workspaceId }, error: null })

    await handleStripeEvent(event("invoice.payment_failed", { customer: "cus_1" }))

    const write = getLastWrite("subscriptions", "update")
    expect(write?.payload).toMatchObject({ status: "past_due" })
    expect(mocks.sendPaymentFailedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        workspaceName: "Acme",
        portalUrl: expect.stringContaining("/settings/billing"),
      }),
    )
  })

  it("skips the email but still records past_due when the owner has no contact", async () => {
    mockSupabaseFrom("subscriptions", { data: { workspace_id: workspaceId }, error: null })
    mocks.getWorkspaceOwnerContact.mockResolvedValueOnce({
      ok: false,
      error: { error: "Workspace owner has no email.", code: "NOT_FOUND" },
    })

    await handleStripeEvent(event("invoice.payment_failed", { customer: "cus_1" }))

    expect(getLastWrite("subscriptions", "update")?.payload).toMatchObject({ status: "past_due" })
    expect(mocks.sendPaymentFailedEmail).not.toHaveBeenCalled()
  })
})

describe("invoice.payment_succeeded", () => {
  it("updates current_period_end from the furthest line period, not the invoice top-level", async () => {
    mockSupabaseFrom("subscriptions", { data: { workspace_id: workspaceId }, error: null })

    // The top-level period_end is the zero-length first-invoice period; the real billing
    // window lives on the line period — the handler must use the line, taking the max.
    await handleStripeEvent(
      event("invoice.payment_succeeded", {
        customer: "cus_1",
        period_end: 1000,
        lines: { data: [{ period: { end: 1000 } }, { period: { end: 5000 } }] },
      }),
    )

    const write = getLastWrite("subscriptions", "update")
    expect(write?.payload).toEqual({ current_period_end: new Date(5000 * 1000).toISOString() })
  })

  it("does not write when there is no line period end", async () => {
    mockSupabaseFrom("subscriptions", { data: { workspace_id: workspaceId }, error: null })

    await handleStripeEvent(event("invoice.payment_succeeded", { customer: "cus_1" }))

    expect(getLastWrite("subscriptions", "update")).toBeUndefined()
  })
})

describe("customer.subscription.trial_will_end", () => {
  it("triggers the trial-ending email send to the workspace owner", async () => {
    await handleStripeEvent(
      event("customer.subscription.trial_will_end", subscriptionObject({ trial_end: 4000 })),
    )

    expect(mocks.sendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        workspaceName: "Acme",
        portalUrl: expect.stringContaining("/settings/billing"),
      }),
    )
  })

  it("sends a null trial-end date when the subscription has no trial_end", async () => {
    await handleStripeEvent(
      event("customer.subscription.trial_will_end", subscriptionObject({ trial_end: null })),
    )

    expect(mocks.sendTrialEndingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ trialEndDate: null }),
    )
  })

  it("skips the trial-ending email when the owner has no contact", async () => {
    mocks.getWorkspaceOwnerContact.mockResolvedValueOnce({
      ok: false,
      error: { error: "Workspace owner has no email.", code: "NOT_FOUND" },
    })

    await handleStripeEvent(
      event("customer.subscription.trial_will_end", subscriptionObject({ trial_end: 4000 })),
    )

    expect(mocks.sendTrialEndingEmail).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })
})

describe("plan-change activity logging", () => {
  it("logs subscription.upgraded when switching between paid tiers (pro → enterprise)", async () => {
    mockSupabaseFrom("subscriptions", { data: { plan_name: "pro" }, error: null })

    await handleStripeEvent(
      event(
        "customer.subscription.updated",
        subscriptionObject({
          items: {
            data: [{ price: { id: "price_enterprise_monthly_test" }, current_period_start: 1, current_period_end: 2 }],
          },
        }),
      ),
    )

    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subscription.upgraded", metadata: { from: "pro", to: "enterprise" } }),
    )
  })

  it("logs subscription.downgraded when switching down between paid tiers (enterprise → pro)", async () => {
    mockSupabaseFrom("subscriptions", { data: { plan_name: "enterprise" }, error: null })

    await handleStripeEvent(event("customer.subscription.updated", subscriptionObject()))

    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "subscription.downgraded", metadata: { from: "enterprise", to: "pro" } }),
    )
  })

  it("does not log when the plan is unchanged (routine renewal)", async () => {
    mockSupabaseFrom("subscriptions", { data: { plan_name: "pro" }, error: null })

    await handleStripeEvent(event("customer.subscription.updated", subscriptionObject()))

    expect(mocks.logActivity).not.toHaveBeenCalled()
  })

  it("does not log the initial free → paid transition (checkout owns that)", async () => {
    mockSupabaseFrom("subscriptions", { data: { plan_name: "free" }, error: null })

    await handleStripeEvent(event("customer.subscription.updated", subscriptionObject()))

    expect(mocks.logActivity).not.toHaveBeenCalled()
  })
})

describe("graceful handling", () => {
  it("logs and skips when no workspace can be resolved", async () => {
    mockSupabaseFrom("subscriptions", { data: null, error: null })

    await handleStripeEvent(
      event("customer.subscription.updated", subscriptionObject({ metadata: {}, customer: null })),
    )

    expect(Sentry.captureMessage).toHaveBeenCalled()
    expect(getLastWrite("subscriptions", "upsert")).toBeUndefined()
  })

  it("skips a subscription event that has no line item", async () => {
    await handleStripeEvent(
      event("customer.subscription.updated", subscriptionObject({ items: { data: [] } })),
    )

    expect(Sentry.captureMessage).toHaveBeenCalled()
    expect(getLastWrite("subscriptions", "upsert")).toBeUndefined()
  })

  it("refuses to write (no downgrade) when a subscription price is unrecognized", async () => {
    await handleStripeEvent(
      event(
        "customer.subscription.updated",
        subscriptionObject({
          items: { data: [{ price: { id: "price_not_in_env" }, current_period_start: 1, current_period_end: 2 }] },
        }),
      ),
    )

    expect(Sentry.captureMessage).toHaveBeenCalled()
    expect(getLastWrite("subscriptions", "upsert")).toBeUndefined()
  })

  it("refuses to write on checkout when the retrieved subscription's price is unrecognized", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue(
      subscriptionObject({
        items: { data: [{ price: { id: "price_not_in_env" }, current_period_start: 1, current_period_end: 2 }] },
      }),
    )

    await handleStripeEvent(
      event("checkout.session.completed", { metadata: { workspaceId }, customer: "cus_1", subscription: "sub_1" }),
    )

    expect(Sentry.captureMessage).toHaveBeenCalled()
    expect(getLastWrite("subscriptions", "upsert")).toBeUndefined()
  })

  it("ignores an unknown event type without error", async () => {
    await expect(
      handleStripeEvent(event("payment_intent.created", {})),
    ).resolves.toBeUndefined()
    expect(getLastWrite("subscriptions")).toBeUndefined()
  })
})
