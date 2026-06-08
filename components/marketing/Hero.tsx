import Link from "next/link"
import { IconArrowRight, IconSparkles } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import DemoLoginButton from "@/components/auth/DemoLoginButton"

const AVATAR_INITIALS = ["DX", "SR", "JK", "ML"]

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center py-20 text-center sm:py-28">
        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: "var(--brand-bg-soft)",
            color: "var(--brand-primary)",
            border: "1px solid var(--brand-border-soft)",
          }}
        >
          <IconSparkles size={13} aria-hidden="true" />
          Production-ready SaaS foundation
        </span>

        {/* Headline */}
        <h1
          className="mt-6 text-4xl font-extrabold sm:text-6xl"
          style={{ color: "var(--text-primary)", lineHeight: 1.05, letterSpacing: "-0.04em" }}
        >
          The foundation every SaaS needs to ship.
        </h1>

        {/* Subhead */}
        <p
          className="mt-6 max-w-xl text-base sm:text-lg"
          style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}
        >
          Auth, workspaces, billing, teams, and admin — wired together on Next.js, Supabase, and
          Stripe. Skip the plumbing and start building what makes your product different.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">
              Get started
              <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
          <DemoLoginButton />
        </div>

        {/* Social proof */}
        <div className="mt-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {AVATAR_INITIALS.map((initials) => (
              <span
                key={initials}
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ring-2"
                style={{
                  background: "var(--brand-bg-soft)",
                  color: "var(--brand-primary)",
                  // ring color via boxShadow so it reads on both themes
                  boxShadow: "0 0 0 2px var(--bg-app)",
                }}
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Trusted by <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>1,200+</span>{" "}
            developers shipping faster
          </p>
        </div>
      </div>
    </section>
  )
}
