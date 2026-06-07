import type { Metadata } from "next"
import { Fragment } from "react"
import { IconCheck, IconMinus } from "@tabler/icons-react"
import PricingTable from "@/components/billing/PricingTable"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for basekit. Start free, upgrade to Pro or Enterprise as you grow.",
  alternates: { canonical: "/pricing" },
}

type Cell = boolean | string

interface ComparisonRow {
  feature: string
  free: Cell
  pro: Cell
  enterprise: Cell
}

const COMPARISON: { group: string; rows: ComparisonRow[] }[] = [
  {
    group: "Core",
    rows: [
      { feature: "Projects", free: "Up to 3", pro: "Unlimited", enterprise: "Unlimited" },
      { feature: "Team members", free: "1", pro: "Up to 10", enterprise: "Unlimited" },
      { feature: "Email authentication", free: true, pro: true, enterprise: true },
      { feature: "Google authentication", free: false, pro: true, enterprise: true },
    ],
  },
  {
    group: "Collaboration",
    rows: [
      { feature: "Team invitations", free: false, pro: true, enterprise: true },
      { feature: "Role management", free: false, pro: true, enterprise: true },
      { feature: "Custom domain", free: false, pro: true, enterprise: true },
    ],
  },
  {
    group: "Enterprise",
    rows: [
      { feature: "SSO / SAML", free: false, pro: false, enterprise: true },
      { feature: "Audit log export", free: false, pro: false, enterprise: true },
      { feature: "Dedicated support", free: false, pro: "Email", enterprise: "Priority" },
    ],
  },
]

const FAQ = [
  {
    question: "Can I change plans later?",
    answer:
      "Yes. Upgrade or downgrade at any time from your billing settings — changes are prorated automatically by Stripe.",
  },
  {
    question: "What happens when I hit a plan limit?",
    answer:
      "You'll see an in-app prompt explaining the limit with a one-click upgrade. Existing data is never deleted when you reach a cap.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Yes — switch the toggle to annual to save 20% on Pro and Enterprise. Annual plans are billed once per year.",
  },
  {
    question: "How does the free plan work?",
    answer:
      "The free plan is free forever: up to 3 projects and a single team member, with email authentication. No credit card required.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. Cancel from the Stripe customer portal and you keep access until the end of your current billing period.",
  },
  {
    question: "Is my data isolated from other customers?",
    answer:
      "Every workspace is isolated at the database level with row-level security, so one tenant can never read another's data.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All major credit and debit cards through Stripe Checkout. Billing, invoices, and receipts are handled by Stripe.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Reach out within 14 days of a charge and we'll sort it out. Annual plans can be prorated and refunded for unused time.",
  },
]

function ComparisonCell({ value }: { value: Cell }) {
  if (value === true) {
    return <IconCheck size={16} style={{ color: "var(--brand-primary)" }} aria-label="Included" />
  }
  if (value === false) {
    return <IconMinus size={16} style={{ color: "var(--text-muted)" }} aria-label="Not included" />
  }
  return (
    <span className="text-sm" style={{ color: "var(--text-primary)" }}>
      {value}
    </span>
  )
}

export default function PricingPage() {
  const proPriceIds = {
    monthly: process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_PRO_ANNUAL"] ?? "",
  }
  const enterprisePriceIds = {
    monthly: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"] ?? "",
  }

  return (
    <div className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <h1
          className="text-4xl font-extrabold sm:text-5xl"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.04em" }}
        >
          Pricing that scales with you
        </h1>
        <p className="mt-4 text-base sm:text-lg" style={{ color: "var(--text-secondary)" }}>
          Start free. Upgrade when you grow. Every plan includes the full production foundation.
        </p>
      </div>

      {/* Plan cards */}
      <div className="mx-auto mt-12 flex max-w-5xl flex-col items-center">
        <PricingTable
          ctaHref="/signup"
          currentPlan="free"
          proPriceIds={proPriceIds}
          enterprisePriceIds={enterprisePriceIds}
        />
      </div>

      {/* Comparison table */}
      <section className="mx-auto mt-24 max-w-5xl">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Compare plans
        </h2>
        <div
          className="mt-6 overflow-x-auto rounded-xl"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                <th className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Feature
                </th>
                {["Free", "Pro", "Enterprise"].map((plan) => (
                  <th
                    key={plan}
                    className="px-4 py-3 text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {plan}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((section) => (
                <Fragment key={section.group}>
                  <tr style={{ background: "var(--bg-surface-hover)" }}>
                    <th
                      colSpan={4}
                      className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {section.group}
                    </th>
                  </tr>
                  {section.rows.map((row) => (
                    <tr
                      key={row.feature}
                      style={{ borderTop: "1px solid var(--border-default)" }}
                    >
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {row.feature}
                      </td>
                      <td className="px-4 py-3">
                        <ComparisonCell value={row.free} />
                      </td>
                      <td className="px-4 py-3">
                        <ComparisonCell value={row.pro} />
                      </td>
                      <td className="px-4 py-3">
                        <ComparisonCell value={row.enterprise} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-24 max-w-3xl">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          Frequently asked questions
        </h2>
        <dl className="mt-6 flex flex-col gap-4">
          {FAQ.map((item) => (
            <div
              key={item.question}
              className="rounded-xl p-5"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <dt className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {item.question}
              </dt>
              <dd className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
