"use client"

import { useActionState } from "react"
import Link from "next/link"
import { signupAction } from "../actions"
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignupPage() {
  const [state, action, isPending] = useActionState(signupAction, null)

  const fieldErrors = (!state?.ok && state?.error.fieldErrors) ? state.error.fieldErrors : {}
  const globalError = !state?.ok && state?.error && !state.error.fieldErrors ? state.error.error : null

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Create an account
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Start building in under a minute
        </p>
      </div>

      <GoogleAuthButton label="Sign up with Google" />

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
          <Label htmlFor="displayName" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Name
          </Label>
          <Input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            placeholder="Jane Smith"
            aria-invalid={!!fieldErrors["displayName"]}
            aria-describedby={fieldErrors["displayName"] ? "displayName-error" : undefined}
          />
          {fieldErrors["displayName"] && (
            <p id="displayName-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
              {fieldErrors["displayName"]}
            </p>
          )}
        </div>

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
          <Label htmlFor="password" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 8 characters"
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
          {isPending ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          Sign in
        </Link>
      </p>
    </>
  )
}
