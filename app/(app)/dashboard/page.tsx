import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"

export const metadata = { title: "Dashboard — basekit" }

export default async function DashboardPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const user = authResult.data
  const workspaceResult = await getWorkspace(user)

  const displayName =
    (user.user_metadata as { display_name?: string } | undefined)?.display_name ??
    user.email ??
    "there"

  const workspaceName = workspaceResult.ok ? workspaceResult.data.name : "your workspace"

  return (
    <main className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg-app)" }}>
      <div
        className="w-full max-w-md rounded-xl p-8 text-center"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Hello, {displayName}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Workspace:{" "}
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {workspaceName}
          </span>
        </p>
        <p
          className="mt-6 text-xs px-3 py-2 rounded-md"
          style={{
            background: "var(--brand-bg-soft)",
            color: "var(--brand-primary)",
            border: "1px solid var(--brand-border-soft)",
          }}
        >
          Checkpoint 1.2 complete — the app shell and full dashboard arrive in 1.3.
        </p>
      </div>
    </main>
  )
}
