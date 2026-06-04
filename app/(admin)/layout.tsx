import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth"

// The admin authorization boundary. requireAdmin() runs before any /admin page
// renders; a non-admin (or signed-out user who slipped past middleware) is bounced to
// the dashboard with a toast trigger. The full admin shell/nav is built in 4.2.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authResult = await requireAdmin()
  if (!authResult.ok) redirect("/dashboard?error=admin_required")

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
