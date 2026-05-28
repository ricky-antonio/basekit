"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { forgotPasswordAction } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { IconMail } from "@tabler/icons-react"

const URL_ERROR_MESSAGES: Record<string, string> = {
  link_expired: "Your reset link is invalid or has expired. Request a new one below.",
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const sent = searchParams.get("sent") === "true"
  const urlError = searchParams.get("error")
  const [state, action, isPending] = useActionState(forgotPasswordAction, null)

  const fieldErrors = (!state?.ok && state?.error.fieldErrors) ? state.error.fieldErrors : {}
  const actionError = !state?.ok && state?.error && !state.error.fieldErrors ? state.error.error : null
  const globalError = actionError ?? (urlError ? URL_ERROR_MESSAGES[urlError] ?? null : null)

  if (sent) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--brand-bg-soft)" }}
        >
          <IconMail size={24} style={{ color: "var(--brand-primary)" }} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Check your inbox
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          If that email is registered, we sent a reset link. Check your spam folder if you don&apos;t see it.
        </p>
        <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          <Link
            href="/login"
            className="font-medium hover:underline"
            style={{ color: "var(--brand-primary)" }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Reset password
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Enter your email and we&apos;ll send a reset link
        </p>
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

        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
          style={{
            background: "var(--brand-primary)",
            color: "var(--text-on-brand)",
          }}
        >
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link
          href="/login"
          className="font-semibold hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          Back to sign in
        </Link>
      </p>
    </>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
