import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-baseline gap-0 text-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span style={{ color: "var(--text-primary)", fontWeight: 400 }}>base</span>
            <span
              style={{
                color: "var(--brand-primary)",
                fontWeight: 800,
              }}
            >
              kit
            </span>
          </Link>
        </div>

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "32px",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
