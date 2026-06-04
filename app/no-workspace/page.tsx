import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { signOutAction } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { IconUsersGroup } from "@tabler/icons-react"

export const metadata = { title: "No workspace — basekit" }

// Stable landing for an authenticated user who belongs to NO workspace — reachable
// after an owner/admin removes a member who joined via invitation (and so never had
// their own workspace). Without this the workspace-gated pages would redirect to
// /login, which the middleware bounces back to /dashboard → redirect loop.
export default async function NoWorkspacePage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 text-center"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
        >
          <IconUsersGroup size={24} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          You&rsquo;re not in a workspace
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          You no longer belong to any workspace. Ask a workspace owner or admin to invite you,
          then sign back in.
        </p>
        <form action={signOutAction} className="mt-6">
          <Button type="submit" className="min-h-11 w-full">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  )
}
