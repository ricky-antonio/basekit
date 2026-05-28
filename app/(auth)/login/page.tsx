"use client"

import { Suspense, useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { loginAction } from "../actions"
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "Authentication failed. Please try signing in again.",
  missing_code: "That sign-in link is invalid or has expired.",
  workspace_failed: "Could not set up your workspace. Please try again.",
  access_denied: "Sign-in was cancelled.",
}

function LoginForm() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get("error")
  const [state, action, isPending] = useActionState(loginAction, null)

  const fieldErrors = (!state?.ok && state?.error.fieldErrors) ? state.error.fieldErrors : {}
  const actionError = !state?.ok && state?.error && !state.error.fieldErrors ? state.error.error : null
  // Action error (most recent) takes precedence over URL error
  const globalError = actionError ?? (urlError ? (ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try signing in again.") : null)

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Sign in
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Welcome back
        </p>
      </div>

      <GoogleAuthButton label="Sign in with Google" />

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 border-t" style={{ borderColor: "var(--border-default)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          or
        </span>
        <div className="flex-1 border-t" style={{ borderColor: "var(--border-default)" }} />
      </div>

      {globalError && (
        <p
          role="alert"
          className="mb-4 rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--danger-bg, #FEF2F2)",
            color: "var(--danger-text, #DC2626)",
            border: "1px solid var(--danger-border, #FECACA)",
          }}
        >
          {globalError}
        </p>
      )}

      <form action={action} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors["email"]}
            aria-describedby={fieldErrors["email"] ? "email-error" : undefined}
          />
          {fieldErrors["email"] && (
            <p id="email-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
              {fieldErrors["email"]}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={!!fieldErrors["password"]}
            aria-describedby={fieldErrors["password"] ? "password-error" : undefined}
          />
          {fieldErrors["password"] && (
            <p id="password-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
              {fieldErrors["password"]}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
          style={{
            background: "var(--brand-primary)",
            color: "var(--text-on-brand)",
          }}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        No account?{" "}
        <Link
          href="/signup"
          className="font-semibold hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          Sign up
        </Link>
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
