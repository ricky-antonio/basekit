import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

// Refreshes the user session on every request so tokens stay current.
// This function is intentionally not tested directly — Next middleware is
// exercised by integration tests and the Supabase SSR library itself.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session — do NOT remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const isProtectedRoute =
    url.pathname.startsWith("/(app)") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/projects") ||
    url.pathname.startsWith("/team") ||
    url.pathname.startsWith("/settings") ||
    url.pathname.startsWith("/admin")

  // Auth pages that signed-in users should be bounced from. /reset-password
  // is intentionally excluded — the password-recovery flow lands there with
  // an active session.
  const isAuthOnlyRoute =
    url.pathname === "/login" ||
    url.pathname === "/signup" ||
    url.pathname === "/forgot-password" ||
    url.pathname === "/verify-email"

  if (!user && isProtectedRoute) {
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && isAuthOnlyRoute) {
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
