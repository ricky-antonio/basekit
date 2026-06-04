import { describe, it, expect } from "vitest"
import { formatCurrency, formatPercent, humanizeAction, FILTERABLE_ACTIONS } from "@/lib/admin-format"

describe("formatCurrency", () => {
  it("renders whole-dollar USD with no decimals", () => {
    expect(formatCurrency(0)).toBe("$0")
    expect(formatCurrency(52)).toBe("$52")
    expect(formatCurrency(1200)).toBe("$1,200")
  })
})

describe("formatPercent", () => {
  it("renders a 0–1 rate as a one-decimal percentage", () => {
    expect(formatPercent(0)).toBe("0.0%")
    expect(formatPercent(0.25)).toBe("25.0%")
    expect(formatPercent(1)).toBe("100.0%")
  })
})

describe("humanizeAction", () => {
  it("maps known actions to curated labels", () => {
    expect(humanizeAction("admin.plan_override")).toBe("Plan override")
    expect(humanizeAction("member.joined")).toBe("Member joined")
  })

  it("title-cases unknown actions instead of showing a slug", () => {
    expect(humanizeAction("some.new_event")).toBe("Some New Event")
  })
})

describe("FILTERABLE_ACTIONS", () => {
  it("includes the audited admin actions", () => {
    expect(FILTERABLE_ACTIONS).toContain("admin.plan_override")
    expect(FILTERABLE_ACTIONS.length).toBeGreaterThan(0)
  })
})
