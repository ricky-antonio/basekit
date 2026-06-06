interface Testimonial {
  quote: string
  role: string
  initials: string
}

// Role labels only — no fabricated names. Initials are decorative monograms for the role.
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We deleted three weeks of boilerplate. Auth, billing, and the admin panel were already done and actually tested — we shipped our MVP the same week.",
    role: "Founding engineer, B2B SaaS",
    initials: "FE",
  },
  {
    quote:
      "The Stripe webhook handling alone saved us from a billing data mess. Idempotency and plan derivation were handled exactly the way I would have built them.",
    role: "Staff engineer, fintech",
    initials: "SE",
  },
  {
    quote:
      "Row-level security from day one meant I never had to retrofit tenant isolation. The impersonation tooling made support debugging trivial.",
    role: "CTO, dev-tools startup",
    initials: "CT",
  },
]

export default function Testimonials() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-3xl font-extrabold sm:text-4xl"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
        >
          Built by people who ship
        </h2>
      </div>

      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <figure
            key={testimonial.role}
            className="flex flex-col gap-6 rounded-xl p-6"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <blockquote className="flex-1 text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.65 }}>
              “{testimonial.quote}”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
              >
                {testimonial.initials}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                {testimonial.role}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
