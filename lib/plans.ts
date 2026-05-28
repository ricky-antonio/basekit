import type { PlanName } from "@/lib/types"

export interface Plan {
  name: PlanName
  label: string
  projectLimit: number | null
  memberLimit: number | null
  features: string[]
  monthlyPriceId: string | null
  annualPriceId: string | null
}

export const PLANS: Record<PlanName, Plan> = {
  free: {
    name: "free",
    label: "Free",
    projectLimit: 3,
    memberLimit: 1,
    features: ["email_auth"],
    monthlyPriceId: null,
    annualPriceId: null,
  },
  pro: {
    name: "pro",
    label: "Pro",
    projectLimit: null,
    memberLimit: 10,
    features: ["email_auth", "google_auth", "custom_domain"],
    monthlyPriceId: process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? null,
    annualPriceId: process.env["STRIPE_PRICE_PRO_ANNUAL"] ?? null,
  },
  enterprise: {
    name: "enterprise",
    label: "Enterprise",
    projectLimit: null,
    memberLimit: null,
    features: ["email_auth", "google_auth", "custom_domain", "sso", "audit_log"],
    monthlyPriceId: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"] ?? null,
    annualPriceId: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"] ?? null,
  },
}

export function getPlanFromPriceId(priceId: string): PlanName {
  for (const plan of Object.values(PLANS)) {
    if (plan.monthlyPriceId === priceId || plan.annualPriceId === priceId) {
      return plan.name
    }
  }
  return "free"
}
