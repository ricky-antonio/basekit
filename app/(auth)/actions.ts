"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/ratelimit"
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth"
import type { ApiResult } from "@/lib/types"

// ------------------------------------------------------------------ //
// Login                                                               //
// ------------------------------------------------------------------ //

export async function loginAction(
  _prevState: ApiResult<null> | null,
  formData: FormData,
): Promise<ApiResult<null>> {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown"
  const email = String(formData.get("email") ?? "")

  const rl = await checkRateLimit("login", `${ip}:${email}`)
  if (!rl.success) return { ok: false, error: rl.error }

  const parsed = loginSchema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    parsed.error.issues.forEach((e) => {
      const key = e.path[0]
      if (key) fieldErrors[String(key)] = e.message
    })
    return { ok: false, error: { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors } }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { ok: false, error: { error: "Wrong email or password.", code: "UNAUTHENTICATED" } }
  }

  redirect("/dashboard")
}

// ------------------------------------------------------------------ //
// Signup                                                              //
// ------------------------------------------------------------------ //

export async function signupAction(
  _prevState: ApiResult<null> | null,
  formData: FormData,
): Promise<ApiResult<null>> {
  const headersList = await headers()
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown"

  const rl = await checkRateLimit("signup", ip)
  if (!rl.success) return { ok: false, error: rl.error }

  const parsed = signupSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    parsed.error.issues.forEach((e) => {
      const key = e.path[0]
      if (key) fieldErrors[String(key)] = e.message
    })
    return { ok: false, error: { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors } }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/callback`,
    },
  })

  if (error) {
    return { ok: false, error: { error: "Could not create account. Please try again.", code: "INTERNAL_ERROR" } }
  }

  redirect("/verify-email")
}

// ------------------------------------------------------------------ //
// Forgot password                                                     //
// ------------------------------------------------------------------ //

export async function forgotPasswordAction(
  _prevState: ApiResult<null> | null,
  formData: FormData,
): Promise<ApiResult<null>> {
  const email = String(formData.get("email") ?? "")

  const rl = await checkRateLimit("passwordReset", email)
  if (!rl.success) return { ok: false, error: rl.error }

  const parsed = forgotPasswordSchema.safeParse({ email })
  if (!parsed.success) {
    return {
      ok: false,
      error: { error: "Invalid email address.", code: "VALIDATION_ERROR", fieldErrors: { email: parsed.error.issues[0]?.message ?? "Invalid email" } },
    }
  }

  const supabase = await createClient()
  // Intentionally ignore errors — never reveal whether the email is registered
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/callback?next=/reset-password`,
  })

  redirect("/forgot-password?sent=true")
}

// ------------------------------------------------------------------ //
// Reset password                                                      //
// ------------------------------------------------------------------ //

export async function resetPasswordAction(
  _prevState: ApiResult<null> | null,
  formData: FormData,
): Promise<ApiResult<null>> {
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    parsed.error.issues.forEach((e) => {
      const key = e.path[0]
      if (key) fieldErrors[String(key)] = e.message
    })
    return { ok: false, error: { error: "Invalid input.", code: "VALIDATION_ERROR", fieldErrors } }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { ok: false, error: { error: "Could not update password. Please try again.", code: "INTERNAL_ERROR" } }
  }

  redirect("/dashboard")
}

// ------------------------------------------------------------------ //
// Sign out                                                            //
// ------------------------------------------------------------------ //

export async function signOutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
