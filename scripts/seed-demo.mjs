// Seed (or remove) a realistic multi-tenant dataset for admin-dashboard demos and
// portfolio screenshots. Service-role writes (bypass RLS). Dev only — never Stripe.
//
//   node scripts/seed-demo.mjs seed     # wipe prior demo data, then insert a fresh set
//   node scripts/seed-demo.mjs clean    # remove all demo data only
//
// Demo rows are tagged three ways so teardown is unambiguous and can NEVER touch a real
// account: email domain @demo.basekit.test, user_metadata.seed === MARKER, slug 'demo-*'.
// Metrics derive from the subscriptions table (see lib/admin-metrics.ts): created_at
// drives the 12-month trend, updated_at + status='canceled' drives 30-day churn, and
// stripe_price_id (matched to the env price IDs) drives MRR with a plan-rate fallback.

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

const MARKER = "basekit-demo"
const EMAIL_DOMAIN = "demo.basekit.test"
const RATE = { pro: { monthly: 29, annual: 23 }, enterprise: { monthly: 99, annual: 79 } }
const REVENUE_STATUSES = new Set(["active", "trialing", "past_due"])

// monthsAgo backdates created_at (trend); canceledDaysAgo backdates updated_at (churn);
// trialDaysLeft sets trial_end in the future. convertedTrial backdates a past trial_end on
// an active sub so it counts toward trial-conversion. projects/members seed the usage bars.
const DEMO = [
  { name: "Ava Chen",    company: "Northwind Labs",  plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 11, projects: 8,  members: 4, convertedTrial: true },
  { name: "Liam Park",   company: "Cedar Analytics", plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 11, projects: 5,  members: 2, convertedTrial: true },
  { name: "Noah Reyes",  company: "Foundry IO",      plan: "free",       interval: null,      status: "active",   monthsAgo: 10, projects: 2,  members: 1 },
  { name: "Maya Singh",  company: "Brightloop",      plan: "enterprise", interval: "monthly", status: "active",   monthsAgo: 10, projects: 12, members: 5, convertedTrial: true },
  { name: "Ethan Wood",  company: "Quanta",          plan: "pro",        interval: "annual",  status: "active",   monthsAgo: 9,  projects: 6,  members: 3, convertedTrial: true },
  { name: "Sofia Rossi", company: "Mapleworks",      plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 8,  projects: 4,  members: 2, convertedTrial: true },
  { name: "Omar Haddad", company: "Driftwood",       plan: "free",       interval: null,      status: "active",   monthsAgo: 8,  projects: 1,  members: 1 },
  { name: "Grace Kim",   company: "Lumen Stack",     plan: "pro",        interval: "monthly", status: "past_due", monthsAgo: 7,  projects: 7,  members: 3 },
  { name: "Lucas Brun",  company: "Verge Systems",   plan: "enterprise", interval: "monthly", status: "active",   monthsAgo: 6,  projects: 10, members: 5, convertedTrial: true },
  { name: "Isla Murphy", company: "Tidepool",        plan: "pro",        interval: "monthly", status: "canceled", monthsAgo: 6,  canceledDaysAgo: 78, projects: 3, members: 2 },
  { name: "Henry Olsen", company: "Cobalt",          plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 5,  projects: 5,  members: 2, convertedTrial: true },
  { name: "Zara Ali",    company: "Fernspark",       plan: "enterprise", interval: "annual",  status: "active",   monthsAgo: 4,  projects: 9,  members: 4 },
  { name: "Theo Fisher", company: "Saplytics",       plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 3,  projects: 4,  members: 2 },
  { name: "Priya Nair",  company: "Glasswing",       plan: "pro",        interval: "monthly", status: "canceled", monthsAgo: 2,  canceledDaysAgo: 12, projects: 2, members: 1 },
  { name: "Owen Tate",   company: "Riverbend",       plan: "pro",        interval: "monthly", status: "active",   monthsAgo: 1,  projects: 3,  members: 1 },
  { name: "Nina Vogel",  company: "Hearthstone",     plan: "pro",        interval: "monthly", status: "trialing", monthsAgo: 0,  trialDaysLeft: 9, projects: 1, members: 1 },
]

const emailFor = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${EMAIL_DOMAIN}`
const slugFor = (company) => `demo-${company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
const iso = (d) => d.toISOString()
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000)
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000)
function monthsAgoDate(m) {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - m)
  d.setUTCDate(15)
  return d
}
function priceFor(plan, interval) {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval === "annual" ? "ANNUAL" : "MONTHLY"}`
  return process.env[key] ?? null
}

async function clean() {
  const { data: workspaces } = await admin.from("workspaces").select("id").like("slug", "demo-%")
  const workspaceIds = (workspaces ?? []).map((w) => w.id)
  if (workspaceIds.length) {
    // cascades workspace_members / subscriptions / usage / invitations
    const { error } = await admin.from("workspaces").delete().in("id", workspaceIds)
    if (error) throw new Error(`workspace delete failed: ${error.message}`)
  }
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const demoUsers = (list?.users ?? []).filter(
    (u) => u.email?.endsWith(`@${EMAIL_DOMAIN}`) || u.user_metadata?.seed === MARKER,
  )
  for (const u of demoUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) throw new Error(`user delete failed (${u.email}): ${error.message}`)
  }
  return { workspaces: workspaceIds.length, users: demoUsers.length }
}

function subscriptionRow(entry, slug, workspaceId, created) {
  const paid = entry.plan !== "free"
  const createdIso = iso(created)
  let periodEnd = null
  let trialEnd = null
  let updatedAt = createdIso
  if (entry.status === "trialing") {
    trialEnd = iso(daysFromNow(entry.trialDaysLeft ?? 14))
    periodEnd = trialEnd
  } else if (entry.status === "canceled") {
    updatedAt = iso(daysAgo(entry.canceledDaysAgo ?? 30))
    periodEnd = updatedAt
  } else if (paid) {
    periodEnd = iso(entry.interval === "annual" ? daysFromNow(330) : daysFromNow(20))
    // A past trial_end on a still-active sub = a trial that converted (lib/admin-metrics
    // counts trial_end !== null + status 'active' toward trialConversionRate).
    if (entry.convertedTrial) trialEnd = iso(new Date(created.getTime() + 14 * 86_400_000))
  }
  return {
    workspace_id: workspaceId,
    plan_name: entry.plan,
    status: entry.status,
    stripe_price_id: paid ? priceFor(entry.plan, entry.interval) : null,
    stripe_customer_id: paid ? `cus_demo_${slug}` : null,
    stripe_subscription_id: paid ? `sub_demo_${slug}` : null,
    cancel_at_period_end: false,
    current_period_start: paid ? createdIso : null,
    current_period_end: periodEnd,
    trial_end: trialEnd,
    created_at: createdIso,
    updated_at: updatedAt,
  }
}

async function seedOne(entry) {
  const email = emailFor(entry.name)
  const slug = slugFor(entry.company)
  const created = monthsAgoDate(entry.monthsAgo)

  const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { seed: MARKER, display_name: entry.name },
  })
  if (userError) throw new Error(`createUser failed (${email}): ${userError.message}`)
  const userId = createdUser.user.id

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, display_name: entry.name }, { onConflict: "id" })
  if (profileError) throw new Error(`profile upsert failed (${email}): ${profileError.message}`)

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .insert({ name: entry.company, slug, owner_id: userId, created_at: iso(created) })
    .select("id")
    .single()
  if (workspaceError) throw new Error(`workspace insert failed (${slug}): ${workspaceError.message}`)

  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: userId, role: "owner", joined_at: iso(created) })
  if (memberError) throw new Error(`member insert failed (${slug}): ${memberError.message}`)

  const { error: subError } = await admin
    .from("subscriptions")
    .insert(subscriptionRow(entry, slug, workspace.id, created))
  if (subError) throw new Error(`subscription insert failed (${slug}): ${subError.message}`)

  const { error: usageError } = await admin.from("usage").insert([
    { workspace_id: workspace.id, resource: "projects", count: entry.projects },
    { workspace_id: workspace.id, resource: "members", count: entry.members },
  ])
  if (usageError) throw new Error(`usage insert failed (${slug}): ${usageError.message}`)
}

function summarize() {
  let mrr = 0
  const planCounts = { free: 0, pro: 0, enterprise: 0 }
  for (const e of DEMO) {
    planCounts[e.plan] += 1
    if (e.plan !== "free" && REVENUE_STATUSES.has(e.status)) mrr += RATE[e.plan][e.interval]
  }
  return { mrr, planCounts }
}

const mode = process.argv[2]
if (mode !== "seed" && mode !== "clean") {
  console.error("usage: node scripts/seed-demo.mjs <seed|clean>")
  process.exit(1)
}

const removed = await clean()
console.log(`cleaned: ${removed.workspaces} workspaces, ${removed.users} demo users`)

if (mode === "clean") {
  console.log("done (clean only).")
  process.exit(0)
}

for (const entry of DEMO) {
  await seedOne(entry)
  console.log(`  + ${entry.company.padEnd(18)} ${entry.plan}/${entry.status}${entry.interval ? ` (${entry.interval})` : ""}`)
}

const { mrr, planCounts } = summarize()
console.log("")
console.log(`seeded ${DEMO.length} demo workspaces`)
console.log(`  plan counts : free ${planCounts.free} · pro ${planCounts.pro} · enterprise ${planCounts.enterprise}`)
console.log(`  demo MRR    : ~$${mrr}/mo  (ARR ~$${mrr * 12})  — excludes your real account`)
console.log("")
console.log("open /admin to view. teardown: node scripts/seed-demo.mjs clean")
