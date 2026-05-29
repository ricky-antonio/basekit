// RLS verification — exercises the LIVE Postgres RLS engine with real user JWTs.
// This is the reproducible form of setup.md §12. Re-run when tables/policies change.
//
//   node scripts/rls-verify.mjs
//
// Creates two confirmed users, has A create a private project, then asserts that
// B and anon cannot read A's rows. Cleans up the test users at the end.

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

// --- load .env.local without extra deps ---
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
  const email = `rls-${tag}-${stamp}@basekit.test`
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

let A, B
try {
  console.log("Setting up two confirmed users + workspaces…")
  A = await makeUser("a")
  B = await makeUser("b")

  // A creates a private project
  const { data: proj, error: pErr } = await A.client
    .from("projects")
    .insert({ workspace_id: A.workspaceId, name: "A secret project" })
    .select("id, name")
    .single()
  check("A can create a project in own workspace (positive control)", !pErr && !!proj, pErr?.message)

  // Positive controls — legitimate access must still work
  {
    const { data } = await A.client.from("subscriptions").select("id").eq("workspace_id", A.workspaceId)
    check("A can read OWN subscription (positive control)", (data?.length ?? 0) === 1)
  }
  {
    const { data } = await A.client.from("projects").select("id")
    check("A can read OWN projects (positive control)", (data?.length ?? 0) === 1)
  }

  // Cross-tenant isolation — B must see nothing of A's
  {
    const { data } = await B.client.from("projects").select("id").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's projects", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("projects").select("id")
    check("B sees zero projects total (has none)", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("subscriptions").select("id").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's subscription", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("workspaces").select("id")
    const onlyOwn = (data?.length ?? 0) === 1 && data[0].id === B.workspaceId
    check("B sees ONLY own workspace", onlyOwn, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("workspace_members").select("workspace_id")
    const onlyOwn = (data ?? []).every((r) => r.workspace_id === B.workspaceId)
    check("B sees ONLY own membership rows", onlyOwn && (data?.length ?? 0) >= 1, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("activity_log").select("id").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's activity_log", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("usage").select("resource").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's usage rows", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("invitations").select("id").eq("workspace_id", A.workspaceId)
    check("B CANNOT read A's invitations", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await B.client.from("profiles").select("id").eq("id", A.id)
    check("B CANNOT read A's profile (cross-tenant)", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
  {
    const { data } = await A.client.from("profiles").select("id").eq("id", A.id)
    check("A can read OWN profile (positive control)", (data?.length ?? 0) === 1)
  }

  // Anon — no session at all
  {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } })
    const { data } = await anon.from("subscriptions").select("id")
    check("Anon CANNOT read subscriptions", (data?.length ?? 0) === 0, `saw ${data?.length ?? 0}`)
  }
} catch (e) {
  console.error("\nSETUP ERROR:", e.message)
  results.push({ name: "setup", pass: false, detail: e.message })
} finally {
  if (A) await admin.auth.admin.deleteUser(A.id).catch(() => {})
  if (B) await admin.auth.admin.deleteUser(B.id).catch(() => {})
  console.log("\nCleaned up test users.")
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${failed.length === 0 ? "✅ ALL RLS CHECKS PASSED" : "❌ " + failed.length + " RLS CHECK(S) FAILED"} (${results.length} total)`)
process.exit(failed.length === 0 ? 0 : 1)
