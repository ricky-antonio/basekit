// Sweep orphaned auth users — confirmed/unconfirmed users that have no
// workspace_members row (i.e. signup happened but bootstrap never ran). Deletes
// them so the email can be reused. Prints everything it removes.
//
//   node scripts/sweep-orphans.mjs

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

// All auth users (paginated)
const users = []
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error("listUsers: " + error.message)
  users.push(...data.users)
  if (data.users.length < 1000) break
}

// All user_ids that DO belong to a workspace
const { data: members, error: mErr } = await admin.from("workspace_members").select("user_id")
if (mErr) throw new Error("workspace_members: " + mErr.message)
const hasWorkspace = new Set((members ?? []).map((r) => r.user_id))

const orphans = users.filter((u) => !hasWorkspace.has(u.id))

console.log(`Total auth users: ${users.length}  |  with a workspace: ${hasWorkspace.size}  |  orphans: ${orphans.length}\n`)

if (orphans.length === 0) {
  console.log("No orphans to sweep.")
  process.exit(0)
}

for (const u of orphans) {
  const confirmed = u.email_confirmed_at ? "confirmed" : "unconfirmed"
  const { error } = await admin.auth.admin.deleteUser(u.id)
  console.log(`  ${error ? "FAILED " : "deleted"}  ${u.email}  (${confirmed}, created ${u.created_at})${error ? " — " + error.message : ""}`)
}

console.log(`\nSwept ${orphans.length} orphaned user(s).`)
