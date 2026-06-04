import Link from "next/link"

export const metadata = { title: "Admin — basekit" }

// Placeholder for Checkpoint 4.1 — the real overview (metric cards, revenue chart,
// plan breakdown, recent activity) is built in 4.2. Reaching this page already proves
// the admin authorization boundary works end to end.
export default function AdminPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
        Admin
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        Metrics, the user table, and the activity log land here in the next checkpoint. The
        admin API (<code className="font-mono text-xs">/api/admin/users</code>,{" "}
        <code className="font-mono text-xs">/api/admin/metrics</code>) is live now.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center text-sm font-medium"
        style={{ color: "var(--brand-primary)" }}
      >
        ← Back to dashboard
      </Link>
    </div>
  )
}
