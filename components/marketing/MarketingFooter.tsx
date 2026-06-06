import Link from "next/link"
import Wordmark from "@/components/marketing/Wordmark"
import ThemeToggle from "@/components/marketing/ThemeToggle"

const GITHUB_URL = "https://github.com"

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features", external: false },
      { label: "Pricing", href: "/pricing", external: false },
      { label: "Sign in", href: "/login", external: false },
      { label: "Get started", href: "/signup", external: false },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: GITHUB_URL, external: true },
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Changelog", href: GITHUB_URL, external: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/#features", external: false },
      { label: "Privacy", href: "/#features", external: false },
      { label: "Terms", href: "/#features", external: false },
    ],
  },
] as const

export default function MarketingFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border-default)" }}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-xs text-sm" style={{ color: "var(--text-secondary)" }}>
              The foundation every SaaS needs to ship.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3"
          >
            {COLUMNS.map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <h3
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {column.heading}
                </h3>
                <ul className="flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: "var(--text-secondary)" }}
                        {...(link.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div
          className="mt-10 flex items-center justify-between pt-6"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} basekit. All rights reserved.
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
