// Set a workspace's subscription plan/status for manual verification.
//
//   node scripts/set-plan.mjs <user-email | workspace-slug> <free|pro|enterprise> [status]
//
// status defaults to 'active'. Service-role write (bypasses RLS). Test/dev only —
// this does NOT touch Stripe, it just sets the local subscriptions row so plan-gated
// flows (member limits, badges) can be exercised without a real Checkout.

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "")
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const [arg, plan, status = "active"] = process.argv.slice(2)
if (!arg || !["free", "pro", "enterprise"].includes(plan)) {
  console.error("usage: node scripts/set-plan.mjs <user-email | workspace-slug> <free|pro|enterprise> [status]")
  process.exit(1)
}

async function resolveWorkspace(arg) {
  if (arg.includes("@")) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 })
    const user = users?.users?.find((u) => u.email?.toLowerCase() === arg.toLowerCase())
    if (!user) throw new Error(`no auth user with email ${arg}`)
    const { data: member } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!member) throw new Error(`user ${arg} has no workspace membership`)
    return member.workspace_id
  }
  const { data: ws } = await admin.from("workspaces").select("id").eq("slug", arg).maybeSingle()
  if (!ws) throw new Error(`no workspace with slug ${arg}`)
  return ws.id
}

const workspaceId = await resolveWorkspace(arg)
const { data, error } = await admin
  .from("subscriptions")
  .update({ plan_name: plan, status })
  .eq("workspace_id", workspaceId)
  .select("plan_name, status")
  .maybeSingle()

if (error) {
  console.error("update failed:", error.message)
  process.exit(1)
}
console.log(`workspace ${workspaceId} → plan_name=${data?.plan_name} status=${data?.status}`)
