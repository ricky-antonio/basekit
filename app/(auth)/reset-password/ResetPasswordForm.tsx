"use client"

import { useActionState } from "react"
import { resetPasswordAction } from "../actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const [state, action, isPending] = useActionState(resetPasswordAction, null)

  const fieldErrors = (!state?.ok && state?.error.fieldErrors) ? state.error.fieldErrors : {}
  const globalError = !state?.ok && state?.error && !state.error.fieldErrors ? state.error.error : null

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Set new password
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Choose a new password for your account
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
          <Label htmlFor="password" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            New password
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

        <div className="space-y-1">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="••••••••"
            aria-invalid={!!fieldErrors["confirmPassword"]}
            aria-describedby={fieldErrors["confirmPassword"] ? "confirmPassword-error" : undefined}
          />
          {fieldErrors["confirmPassword"] && (
            <p id="confirmPassword-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
              {fieldErrors["confirmPassword"]}
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
          {isPending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </>
  )
}
