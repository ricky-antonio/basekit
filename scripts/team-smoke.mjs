// Team backend smoke test — exercises the LIVE DB + RLS for the two new Phase-3.2
// write paths that mocks can't cover: the owner/admin invitation INSERT (under RLS)
// and the service-role accept (membership insert + usage increment + accepted_at).
//
//   node scripts/team-smoke.mjs
//
// A = workspace owner, B = unrelated outsider (isolation checks), C = invitee who
// accepts. Mirrors what inviteMember / acceptInvitation do at the DB layer (it does
// NOT exercise the HTTP routes/cookie auth — that's the 3.3 UI pass). Self-cleaning.

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "")
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const stamp = Date.now()

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`)
}

async function makeUser(tag) {
  const email = `team-${tag}-${stamp}@basekit.test`
  const password = `Test-${stamp}-${tag}!`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw new Error(`createUser ${tag}: ${error.message}`)
  const { data: ws, error: wErr } = await admin.rpc("bootstrap_workspace", {
    p_user_id: data.user.id,
    p_name: `WS ${tag}`,
    p_slug: `ws-${tag}-${stamp}`,
  })
  if (wErr) throw new Error(`bootstrap ${tag}: ${wErr.message}`)
  const client = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: sErr } = await client.auth.signInWithPassword({ email, password })
  if (sErr) throw new Error(`signIn ${tag}: ${sErr.message}`)
  return { id: data.user.id, email, workspaceId: ws, client }
}

async function membersCount(workspaceId) {
  const { data } = await admin.from("usage").select("count").eq("workspace_id", workspaceId).eq("resource", "members").maybeSingle()
  return data?.count ?? 0
}

let A, B, C
try {
  console.log("Setting up three confirmed users + workspaces…")
  A = await makeUser("owner")
  B = await makeUser("outsider")
  C = await makeUser("invitee")

  // --- INVITE path: owner inserts an invitation under RLS (invitations_insert_owner_or_admin) ---
  const { data: invite, error: invErr } = await A.client
    .from("invitations")
    .insert({ workspace_id: A.workspaceId, email: C.email, role: "member" })
    .select("id, token, accepted_at")
    .single()
  check("A (owner) can INSERT an invitation in own workspace", !invErr && !!invite, invErr?.message)
  check("invitation has an auto-generated token + accepted_at null", !!invite?.token && invite?.accepted_at === null)

  // Negative: an outsider cannot insert an invitation into A's workspace
  {
    const { error } = await B.client
      .from("invitations")
      .insert({ workspace_id: A.workspaceId, email: "x@y.com", role: "member" })
    check("B (outsider) CANNOT insert an invitation into A's workspace", !!error, error ? "blocked" : "INSERT SUCCEEDED")
  }

  // Negative: an outsider cannot read A's pending invitations
  {
    const { data } = await B.client.from("invitations").select("id").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's invitations", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }

  // --- ACCEPT path: service role inserts membership + increments usage + sets accepted_at ---
  const before = await membersCount(A.workspaceId)

  const { error: memErr } = await admin
    .from("workspace_members")
    .insert({ workspace_id: A.workspaceId, user_id: C.id, role: "member" })
  check("service role can INSERT the accepting member", !memErr, memErr?.message)

  const { error: incErr } = await admin.rpc("increment_usage", { p_workspace_id: A.workspaceId, p_resource: "members" })
  check("increment_usage('members') succeeds", !incErr, incErr?.message)

  const { error: updErr } = await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
  check("invitation accepted_at can be set", !updErr, updErr?.message)

  const after = await membersCount(A.workspaceId)
  check("usage.members incremented by exactly 1", after === before + 1, `${before} → ${after}`)

  {
    const { data } = await admin.from("invitations").select("accepted_at").eq("id", invite.id).single()
    check("invitation row now shows accepted_at set", !!data?.accepted_at)
  }
  {
    const { data } = await admin.from("workspace_members").select("user_id").eq("workspace_id", A.workspaceId).eq("user_id", C.id)
    check("C now has a membership row in A's workspace", (data?.length ?? 0) === 1)
  }

  // Positive RLS after join: C (now a member) can read A's workspace members; B still cannot
  {
    const { data } = await C.client.from("workspace_members").select("user_id").eq("workspace_id", A.workspaceId)
    check("C (now a member) CAN read A's workspace members", (data?.length ?? 0) === 2, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("workspace_members").select("user_id").eq("workspace_id", A.workspaceId)
    check("B (outsider) CANNOT read A's workspace members", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
} catch (e) {
  console.error("\nSETUP ERROR:", e.message)
  results.push({ name: "setup", pass: false, detail: e.message })
} finally {
  if (A) await admin.auth.admin.deleteUser(A.id).catch(() => {})
  if (B) await admin.auth.admin.deleteUser(B.id).catch(() => {})
  if (C) await admin.auth.admin.deleteUser(C.id).catch(() => {})
  console.log("\nCleaned up test users.")
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${failed.length === 0 ? "✅ ALL TEAM SMOKE CHECKS PASSED" : "❌ " + failed.length + " CHECK(S) FAILED"} (${results.length} total)`)
process.exit(failed.length === 0 ? 0 : 1)
