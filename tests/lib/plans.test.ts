import { describe, it, expect } from "vitest"
import { PLANS, getPlanFromPriceId } from "@/lib/plans"

describe("PLANS", () => {
  it("Free plan has 3 project limit", () => {
    expect(PLANS.free.projectLimit).toBe(3)
  })

  it("Pro plan has null project limit (unlimited)", () => {
    expect(PLANS.pro.projectLimit).toBeNull()
  })

  it("Enterprise plan has null member limit", () => {
    expect(PLANS.enterprise.memberLimit).toBeNull()
  })

  it("Free plan features only include 'email_auth'", () => {
    expect(PLANS.free.features).toEqual(["email_auth"])
  })
})

describe("getPlanFromPriceId", () => {
  it("returns 'pro' for pro monthly env price ID", () => {
    expect(getPlanFromPriceId("price_pro_monthly_test")).toBe("pro")
  })

  it("returns 'pro' for pro annual env price ID", () => {
    expect(getPlanFromPriceId("price_pro_annual_test")).toBe("pro")
  })

  it("returns 'enterprise' for enterprise monthly", () => {
    expect(getPlanFromPriceId("price_enterprise_monthly_test")).toBe("enterprise")
  })

  it("returns 'enterprise' for enterprise annual", () => {
    expect(getPlanFromPriceId("price_enterprise_annual_test")).toBe("enterprise")
  })

  it("returns 'free' for unknown price ID", () => {
    expect(getPlanFromPriceId("price_unknown_xyz")).toBe("free")
  })
})
