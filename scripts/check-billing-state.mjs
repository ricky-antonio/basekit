// Inspect live billing state for a workspace — used during manual billing verification.
//
//   node scripts/check-billing-state.mjs <user-email | workspace-slug>
//
// Prints the workspace, its subscriptions row, and usage counters using the
// service-role client (bypasses RLS — read-only inspection).

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "")
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const arg = process.argv[2]

if (!arg) {
  console.error("usage: node scripts/check-billing-state.mjs <user-email | workspace-slug>")
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

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

const { data: ws } = await admin
  .from("workspaces")
  .select("id, name, slug, owner_id")
  .eq("id", workspaceId)
  .single()

const { data: sub } = await admin
  .from("subscriptions")
  .select(
    "plan_name, status, cancel_at_period_end, current_period_end, trial_end, stripe_customer_id, stripe_subscription_id, stripe_price_id, updated_at",
  )
  .eq("workspace_id", workspaceId)
  .maybeSingle()

const { data: usage } = await admin
  .from("usage")
  .select("resource, count")
  .eq("workspace_id", workspaceId)

const fmtTs = (t) => {
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? `(unparseable: ${t})` : d.toISOString()
}

console.log(`\nworkspace : ${ws.name}  (slug=${ws.slug}, id=${ws.id})`)
console.log(`owner_id  : ${ws.owner_id}`)
if (!sub) {
  console.log("subscription: (no row)")
} else {
  console.log("subscription:")
  console.log(`  plan_name             : ${sub.plan_name}`)
  console.log(`  status                : ${sub.status}`)
  console.log(`  cancel_at_period_end  : ${sub.cancel_at_period_end}`)
  console.log(`  current_period_end    : ${sub.current_period_end}  (${fmtTs(sub.current_period_end)})`)
  console.log(`  trial_end             : ${sub.trial_end}  (${fmtTs(sub.trial_end)})`)
  console.log(`  stripe_customer_id    : ${sub.stripe_customer_id}`)
  console.log(`  stripe_subscription_id: ${sub.stripe_subscription_id}`)
  console.log(`  stripe_price_id       : ${sub.stripe_price_id}`)
  console.log(`  updated_at            : ${sub.updated_at}`)
}
console.log("usage:")
for (const u of usage ?? []) console.log(`  ${u.resource}: ${u.count}`)
console.log("")
