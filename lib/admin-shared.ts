import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import type { PlanName } from "@/lib/types"

// Helpers shared by the admin reads (lib/admin.ts) and the admin write (lib/admin-override.ts).
// Both run as the service role and resolve owner identities the same way.

export function normalizePlan(value: string): PlanName {
  return value === "pro" || value === "enterprise" ? value : "free"
}

// Demo workspaces are slugged 'demo-*' by scripts/seed-demo.mjs. Admin reads scope to these
// when the acting admin is the public demo account, so real tenants never leak into the demo.
export const DEMO_WORKSPACE_PREFIX = "demo-"

export async function getDemoWorkspaceIds(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<string[]> {
  const { data } = await supabase.from("workspaces").select("id").like("slug", `${DEMO_WORKSPACE_PREFIX}%`)
  return (data ?? []).map((w) => w.id)
}

export interface ResolvedAccount {
  email: string | null
  metaName: string | null
}

// Emails live in auth.users (unreadable via the data API), so they're resolved one user
// at a time through the admin API — mirroring lib/team.listTeamMembers. Each lookup is
// isolated so one thrown admin error degrades to "no email" rather than failing the caller.
export async function resolveAccount(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<ResolvedAccount> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const metadata = data?.user?.user_metadata as { display_name?: string } | undefined
    return { email: data?.user?.email ?? null, metaName: metadata?.display_name ?? null }
  } catch (error) {
    console.error("[admin-shared.resolveAccount] getUserById failed", error)
    Sentry.captureException(error)
    return { email: null, metaName: null }
  }
}
