import type { ApiError } from "@/lib/types"

// Demo-mode guardrails. The public "Explore the demo" button signs in a shared admin
// account (DEMO_USER_EMAIL) that lives in the same database as real accounts, so the
// destructive admin/account writes are blocked when the acting account is a demo account,
// and impersonation is limited to the seeded demo accounts. "Demo accounts" = the dedicated
// login account plus the @demo.basekit.test seed set (see scripts/seed-demo.mjs).

const DEMO_DOMAIN = "@demo.basekit.test"

// Pure + env-read-per-call so it stays correct in tests and across env changes.
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.toLowerCase()
  const demoLogin = process.env["DEMO_USER_EMAIL"]?.toLowerCase()
  return (!!demoLogin && normalized === demoLogin) || normalized.endsWith(DEMO_DOMAIN)
}

export const DEMO_DISABLED_ERROR: ApiError = {
  error: "This action is disabled in the demo.",
  code: "FORBIDDEN",
}
