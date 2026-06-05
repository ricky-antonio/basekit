import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth"
import { getImpersonationContext } from "@/lib/impersonation"
import AdminNav from "@/components/admin/AdminNav"
import ImpersonateBanner from "@/components/admin/ImpersonateBanner"

// The admin authorization boundary. requireAdmin() runs before any /admin page
// renders; a non-admin (or signed-out user who slipped past middleware) is bounced to
// the dashboard with a toast trigger. AdminNav is the section's shell/nav.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authResult = await requireAdmin()
  if (!authResult.ok) redirect("/dashboard?error=admin_required")

  const impersonation = await getImpersonationContext()

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      <ImpersonateBanner context={impersonation} />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminNav />
        {children}
      </main>
    </div>
  )
}
