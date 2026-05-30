import { describe, it, expect } from "vitest"
import {
  checkoutBodySchema,
  portalBodySchema,
  subscriptionEventSchema,
  checkoutSessionSchema,
  invoiceEventSchema,
} from "@/lib/validation/billing"

describe("checkoutBodySchema", () => {
  it("accepts a configured price ID", () => {
    expect(checkoutBodySchema.safeParse({ priceId: "price_pro_monthly_test" }).success).toBe(true)
  })

  it("rejects an unconfigured price ID", () => {
    expect(checkoutBodySchema.safeParse({ priceId: "price_made_up" }).success).toBe(false)
  })

  it("rejects an empty price ID", () => {
    expect(checkoutBodySchema.safeParse({ priceId: "" }).success).toBe(false)
  })
})

describe("portalBodySchema", () => {
  it("accepts an absent returnPath", () => {
    expect(portalBodySchema.safeParse({}).success).toBe(true)
  })

  it("rejects a non-relative returnPath", () => {
    expect(portalBodySchema.safeParse({ returnPath: "https://evil.com" }).success).toBe(false)
  })
})

describe("checkoutSessionSchema", () => {
  it("extracts metadata, customer, and subscription as id strings", () => {
    const parsed = checkoutSessionSchema.safeParse({
      metadata: { workspaceId: "ws-1" },
      customer: "cus_1",
      subscription: { id: "sub_1" },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.metadata?.workspaceId).toBe("ws-1")
      expect(parsed.data.customer).toBe("cus_1")
    }
  })
})

describe("subscriptionEventSchema", () => {
  it("parses a subscription with item-level period fields", () => {
    const parsed = subscriptionEventSchema.safeParse({
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: true,
      trial_end: null,
      metadata: { workspaceId: "ws-1" },
      items: {
        data: [
          {
            price: { id: "price_pro_monthly_test" },
            current_period_start: 1000,
            current_period_end: 2000,
          },
        ],
      },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.items.data[0]?.price.id).toBe("price_pro_monthly_test")
      expect(parsed.data.cancel_at_period_end).toBe(true)
    }
  })

  it("rejects a payload missing items", () => {
    expect(subscriptionEventSchema.safeParse({ id: "sub_1", status: "active" }).success).toBe(false)
  })
})

describe("invoiceEventSchema", () => {
  it("parses customer and line period ends", () => {
    const parsed = invoiceEventSchema.safeParse({
      customer: "cus_1",
      lines: { data: [{ period: { end: 5000 } }] },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.customer).toBe("cus_1")
      expect(parsed.data.lines?.data[0]?.period?.end).toBe(5000)
    }
  })

  it("parses when lines are absent", () => {
    const parsed = invoiceEventSchema.safeParse({ customer: "cus_1" })
    expect(parsed.success).toBe(true)
  })
})
