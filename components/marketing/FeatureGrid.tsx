import {
  IconLock,
  IconCreditCard,
  IconUsers,
  IconShieldLock,
  IconBolt,
  IconBug,
  type IconProps,
} from "@tabler/icons-react"
import type { ComponentType } from "react"

interface Feature {
  icon: ComponentType<IconProps>
  title: string
  description: string
  tech: string
}

const FEATURES: Feature[] = [
  {
    icon: IconLock,
    title: "Auth & workspaces",
    description:
      "Email and Google sign-in with verified onboarding. Every account gets its own workspace, isolated by row-level security.",
    tech: "Supabase",
  },
  {
    icon: IconCreditCard,
    title: "Billing & subscriptions",
    description:
      "Checkout, customer portal, and plan derivation handled end to end. Webhooks stay idempotent so subscription state never corrupts.",
    tech: "Stripe",
  },
  {
    icon: IconUsers,
    title: "Teams & invitations",
    description:
      "Invite teammates by email with single-use tokens and role management. Transactional emails are typed React components.",
    tech: "Resend",
  },
  {
    icon: IconShieldLock,
    title: "Admin & impersonation",
    description:
      "A full admin console with metrics, audited plan overrides, and read-observational impersonation. Every action is logged.",
    tech: "RLS",
  },
  {
    icon: IconBolt,
    title: "Rate limiting",
    description:
      "Sliding-window limits guard every auth, billing, and admin surface. Edge-compatible and serverless-friendly out of the box.",
    tech: "Upstash",
  },
  {
    icon: IconBug,
    title: "Error tracking",
    description:
      "Webhook and API failures report to Sentry while returning safe responses. You find out before your customers do.",
    tech: "Sentry",
  },
]

export default function FeatureGrid() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-3xl font-extrabold sm:text-4xl"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
        >
          Everything a SaaS needs, already wired
        </h2>
        <p className="mt-4 text-base" style={{ color: "var(--text-secondary)" }}>
          Six production systems, integrated and tested — not a pile of disconnected starters.
        </p>
      </div>

      <ul className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <li
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl p-6"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {feature.title}
              </h3>
              <p className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {feature.description}
              </p>
              <span
                data-slot="tech-pill"
                className="inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-mono text-xs"
                style={{
                  background: "var(--bg-surface-hover)",
                  color: "var(--text-secondary)",
                }}
              >
                {feature.tech}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
