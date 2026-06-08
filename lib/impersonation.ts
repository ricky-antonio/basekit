import { createHash } from "node:crypto"
import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import * as Sentry from "@sentry/nextjs"
import { createServiceClient } from "@/lib/supabase/server"
import { isDemoEmail } from "@/lib/demo"
import type { AuthUser } from "@/lib/auth"
import type { ApiResult } from "@/lib/types"

// Admin impersonation: a signed, httpOnly cookie that lets getUser() return the target
// user. The cookie is the proof of an active impersonation session — it is only honored
// for the admin who minted it (getUser checks adminId === session user AND role=admin),
// so a leaked/forged cookie is inert without that admin's session.

export const IMPERSONATION_COOKIE = "bk_impersonate"
const TTL_SECONDS = 30 * 60
const ALG = "HS256"

export interface ImpersonationContext {
  adminId: string
  targetUserId: string
  targetEmail: string | null
  expiresAt: number
}

// HS256 requires a >=256-bit key; the service-role key length isn't guaranteed, so
// derive a fixed 32-byte key from it. Server-only secret (never NEXT_PUBLIC_*).
function signingKey(): Uint8Array {
  return new Uint8Array(createHash("sha256").update(process.env["SUPABASE_SERVICE_ROLE_KEY"]!).digest())
}

export interface StartImpersonationParams {
  admin: AuthUser
  targetUserId: string
}

export async function startImpersonation(
  params: StartImpersonationParams,
): Promise<ApiResult<ImpersonationContext>> {
  const { admin, targetUserId } = params

  if (admin.role !== "admin") {
    return { ok: false, error: { error: "You do not have permission to impersonate users.", code: "FORBIDDEN" } }
  }
  if (targetUserId === admin.id) {
    return { ok: false, error: { error: "You cannot impersonate yourself.", code: "VALIDATION_ERROR" } }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.getUserById(targetUserId)
  if (error || !data?.user) {
    return { ok: false, error: { error: "User not found.", code: "NOT_FOUND" } }
  }

  const targetEmail = data.user.email ?? null

  // The public demo account (itself admin) may impersonate only the seeded demo accounts,
  // never a real user — impersonation is read-only, but a real account's data still leaks.
  if (isDemoEmail(admin.email) && !isDemoEmail(targetEmail)) {
    return { ok: false, error: { error: "In the demo you can only impersonate demo accounts.", code: "FORBIDDEN" } }
  }

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + TTL_SECONDS

  let token: string
  try {
    token = await new SignJWT({ adminId: admin.id, targetUserId, targetEmail })
      .setProtectedHeader({ alg: ALG })
      .setIssuedAt()
      .setExpirationTime(expiresAtSeconds)
      .sign(signingKey())
  } catch (signError) {
    console.error("[impersonation.start] sign failed", signError)
    Sentry.captureException(signError)
    return { ok: false, error: { error: "Could not start impersonation. Please try again.", code: "INTERNAL_ERROR" } }
  }

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  })

  return {
    ok: true,
    data: { adminId: admin.id, targetUserId, targetEmail, expiresAt: expiresAtSeconds * 1000 },
  }
}

// Clears the cookie and returns whatever context was active (so the caller can audit
// the ended session). Always safe to call — a missing/invalid cookie returns null.
export async function endImpersonation(): Promise<ImpersonationContext | null> {
  const context = await getImpersonationContext()
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)
  return context
}

export async function getImpersonationContext(): Promise<ImpersonationContext | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!token) return null

  try {
    // jwtVerify enforces the signature AND the exp claim (throws when expired).
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: [ALG] })
    const adminId = typeof payload.adminId === "string" ? payload.adminId : null
    const targetUserId = typeof payload.targetUserId === "string" ? payload.targetUserId : null
    if (!adminId || !targetUserId) return null
    return {
      adminId,
      targetUserId,
      targetEmail: typeof payload.targetEmail === "string" ? payload.targetEmail : null,
      expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : 0,
    }
  } catch {
    // Expired, bad signature, or malformed — treat as no impersonation.
    return null
  }
}
