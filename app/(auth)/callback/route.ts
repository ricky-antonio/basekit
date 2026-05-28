import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, bootstrapWorkspace } from "@/lib/workspace"

// Same-origin, single-leading-slash paths only. Rejects protocol-relative
// ("//evil.com"), backslash variants ("/\evil.com" which Chrome normalises),
// and anything that isn't a path.
function isSafeRedirect(path: string): boolean {
  if (!path.startsWith("/")) return false
  if (path.startsWith("//")) return false
  if (path.startsWith("/\\")) return false
  return true
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Surface Supabase / OAuth provider errors that arrive without a code
  const providerError = searchParams.get("error")
  if (providerError) {
    const params = new URLSearchParams({ error: providerError })
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, request.url))
  }

  const code = searchParams.get("code")
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = isSafeRedirect(rawNext) ? rawNext : "/dashboard"

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
  }

  const user = data.user

  const workspaceResult = await getWorkspace(user)
  if (!workspaceResult.ok) {
    const bootstrapResult = await bootstrapWorkspace(user.id, user.email ?? "")
    if (!bootstrapResult.ok) {
      return NextResponse.redirect(new URL("/login?error=workspace_failed", request.url))
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
