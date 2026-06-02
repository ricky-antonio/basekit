import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getWorkspace } from "@/lib/workspace"
import { listTeamMembers } from "@/lib/team"

// Enriched member roster for the team page. getWorkspace resolves the caller's
// workspace via their own membership, so reaching listTeamMembers (service role)
// already proves the caller is a member — the service-role enrichment returns only
// their own workspace's data.
export async function GET(): Promise<Response> {
  const authResult = await requireAuth()
  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: 401 })
  }

  const workspaceResult = await getWorkspace(authResult.data)
  if (!workspaceResult.ok) {
    return NextResponse.json(workspaceResult.error, { status: 404 })
  }

  const result = await listTeamMembers(workspaceResult.data.id)
  if (!result.ok) {
    return NextResponse.json(result.error, { status: 500 })
  }

  return NextResponse.json({ members: result.data, currentUserId: authResult.data.id })
}
