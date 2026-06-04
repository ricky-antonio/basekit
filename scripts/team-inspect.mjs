// Inspect live team state for a workspace — used during Phase 3 manual verification.
//
//   node scripts/team-inspect.mjs <user-email | workspace-slug>
//
// Prints members (role + email + joined), pending/accepted invitations (incl. token),
// usage counters, and recent activity_log rows using the service-role client
// (bypasses RLS — read-only inspection).

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
  console.error("usage: node scripts/team-inspect.mjs <user-email | workspace-slug>")
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

const { data: members } = await admin
  .from("workspace_members")
  .select("user_id, role, joined_at")
  .eq("workspace_id", workspaceId)
  .order("joined_at", { ascending: true })

const { data: profiles } = await admin
  .from("profiles")
  .select("id, display_name")
  .in("id", (members ?? []).map((m) => m.user_id))
const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))

const { data: invites } = await admin
  .from("invitations")
  .select("email, role, token, invited_by, accepted_at, expires_at, created_at")
  .eq("workspace_id", workspaceId)
  .order("created_at", { ascending: false })

const { data: usage } = await admin
  .from("usage")
  .select("resource, count")
  .eq("workspace_id", workspaceId)

const { data: activity } = await admin
  .from("activity_log")
  .select("action, actor_id, target_type, target_id, metadata, created_at")
  .eq("workspace_id", workspaceId)
  .order("created_at", { ascending: false })
  .limit(12)

const emailOf = new Map()
for (const m of members ?? []) {
  const { data } = await admin.auth.admin.getUserById(m.user_id)
  emailOf.set(m.user_id, data?.user?.email ?? "(no email)")
}

const short = (id) => (id ? `${id.slice(0, 8)}…` : "—")
const fmt = (t) => (t ? new Date(t).toISOString().replace("T", " ").slice(0, 19) : null)

console.log(`\nworkspace : ${ws.name}  (slug=${ws.slug}, id=${ws.id})`)
console.log(`owner_id  : ${short(ws.owner_id)}`)

console.log(`\nmembers (${members?.length ?? 0}):`)
for (const m of members ?? []) {
  const self = m.user_id === ws.owner_id ? "  [owner]" : ""
  console.log(`  ${m.role.padEnd(6)} ${emailOf.get(m.user_id)?.padEnd(34)} ${nameOf.get(m.user_id) ?? "—"}  joined ${fmt(m.joined_at)}${self}`)
}

console.log(`\ninvitations (${invites?.length ?? 0}):`)
for (const i of invites ?? []) {
  const state = i.accepted_at ? `accepted ${fmt(i.accepted_at)}` : `pending (expires ${fmt(i.expires_at)})`
  console.log(`  ${i.role.padEnd(6)} ${i.email.padEnd(34)} ${state}`)
  console.log(`         token=${i.token}`)
}

console.log(`\nusage:`)
for (const u of usage ?? []) console.log(`  ${u.resource}: ${u.count}`)

console.log(`\nrecent activity:`)
for (const a of activity ?? []) {
  console.log(`  ${fmt(a.created_at)}  ${a.action.padEnd(20)} actor=${short(a.actor_id)} target=${a.target_type ?? "—"}:${short(a.target_id)}  ${JSON.stringify(a.metadata)}`)
}
console.log("")
