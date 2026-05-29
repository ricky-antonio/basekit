import { type NextRequest, NextResponse } from "next/server"
import type { EmailOtpType, User } from "@supabase/supabase-js"
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
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  // Password-recovery links must land on the reset form, not the dashboard.
  const fallbackNext = type === "recovery" ? "/reset-password" : "/dashboard"
  const rawNext = searchParams.get("next") ?? fallbackNext
  const next = isSafeRedirect(rawNext) ? rawNext : fallbackNext

  const supabase = await createClient()

  // Two entry points share this route:
  //  - Email links (signup confirm, recovery, magic link, email change) arrive as a
  //    token_hash → verifyOtp. This does NOT depend on a PKCE code-verifier cookie,
  //    so it survives links opened from a mail client / different tab.
  //  - OAuth (Google) arrives as a code → exchangeCodeForSession (verifier cookie set
  //    in the same browser at sign-in time).
  let user: User | null = null

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error || !data.user) {
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
    }
    user = data.user
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
    }
    user = data.user
  } else {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url))
  }

  // Recovery authenticates the user only to set a new password — they already have a
  // workspace, so skip bootstrap and send them straight to the reset form.
  if (type === "recovery") {
    return NextResponse.redirect(new URL(next, request.url))
  }

  const workspaceResult = await getWorkspace(user)
  if (!workspaceResult.ok) {
    const bootstrapResult = await bootstrapWorkspace(user.id, user.email ?? "")
    if (!bootstrapResult.ok) {
      return NextResponse.redirect(new URL("/login?error=workspace_failed", request.url))
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
