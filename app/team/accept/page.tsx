import { getUser } from "@/lib/auth"
import AcceptInvitation from "@/components/team/AcceptInvitation"

export const metadata = { title: "Accept invitation — basekit" }

// Public (outside the (app) shell): an invitee may not have an account yet. The token
// is read from the query; AcceptInvitation fetches the service-role preview and drives
// the accept / sign-up paths.
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const user = await getUser()

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-lg tracking-tight select-none">
          <span className="font-normal" style={{ color: "var(--text-primary)" }}>
            base
          </span>
          <span className="font-extrabold" style={{ color: "var(--brand-primary)", letterSpacing: "-0.02em" }}>
            kit
          </span>
        </div>

        {token ? (
          <AcceptInvitation token={token} isAuthenticated={!!user} />
        ) : (
          <div
            role="alert"
            className="rounded-xl p-6 text-center"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Invitation missing
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              This link is missing its invitation token. Ask the workspace owner to send a new invite.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
