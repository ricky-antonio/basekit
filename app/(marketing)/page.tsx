import type { Metadata } from "next"
import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import Hero from "@/components/marketing/Hero"
import FeatureGrid from "@/components/marketing/FeatureGrid"
import Testimonials from "@/components/marketing/Testimonials"
import PricingTable from "@/components/billing/PricingTable"

export const metadata: Metadata = {
  title: "basekit — The foundation every SaaS needs to ship",
  description:
    "A production-ready SaaS foundation: auth, workspaces, billing, teams, and admin on Next.js, Supabase, and Stripe.",
}

const TECH = ["Next.js", "Tailwind", "Supabase", "Stripe", "Resend", "Vercel"]

export default function LandingPage() {
  const proPriceIds = {
    monthly: process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_PRO_ANNUAL"] ?? "",
  }
  const enterprisePriceIds = {
    monthly: process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"] ?? "",
    annual: process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"] ?? "",
  }

  return (
    <>
      {/* Section 2 — Hero */}
      <Hero />

      {/* Section 3 — Tech strip */}
      <section className="px-4 pb-12 sm:px-6 lg:px-8">
        <p
          className="text-center text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Built on the stack you already use
        </p>
        <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TECH.map((name) => (
            <li
              key={name}
              className="text-sm font-semibold transition-colors hover:text-text-primary"
              style={{ color: "var(--text-muted)" }}
            >
              {name}
            </li>
          ))}
        </ul>
      </section>

      {/* Section 4 — Features grid */}
      <FeatureGrid />

      {/* Section 5 — Pricing (dark) */}
      <section
        id="pricing"
        className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
        style={{ background: "#0A0A0A" }}
      >
        {/* Ambient teal glow — the single allowed gradient (see design.md strict don'ts) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, rgba(13,148,136,0.28) 0%, rgba(13,148,136,0) 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="text-center">
            <h2
              className="text-3xl font-extrabold sm:text-4xl"
              style={{ color: "#FAFAFA", letterSpacing: "-0.03em" }}
            >
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-base" style={{ color: "#A8A29E" }}>
              Start free. Upgrade when you grow. Cancel anytime.
            </p>
          </div>
          <div className="mt-10 flex flex-col items-center">
            <PricingTable
              variant="dark"
              ctaHref="/signup"
              currentPlan="free"
              proPriceIds={proPriceIds}
              enterprisePriceIds={enterprisePriceIds}
            />
          </div>
          <p className="mt-8 text-center text-sm" style={{ color: "#A8A29E" }}>
            Need a full feature comparison?{" "}
            <Link href="/pricing" className="font-semibold" style={{ color: "#2DD4BF" }}>
              See all plans
            </Link>
          </p>
        </div>
      </section>

      {/* Section 6 — Testimonials */}
      <Testimonials />

      {/* Section 7 — CTA strip */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div
          className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-2xl px-6 py-16 text-center"
          style={{ background: "var(--brand-bg-soft)", border: "1px solid var(--brand-border-soft)" }}
        >
          <h2
            className="text-3xl font-extrabold sm:text-4xl"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            Ready to ship?
          </h2>
          <p className="max-w-md text-base" style={{ color: "var(--text-secondary)" }}>
            Stop rebuilding the same foundation. Start with basekit and ship the part that matters.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started
                <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
