"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PageHeader from "@/components/shared/PageHeader"
import { changePasswordAction } from "@/app/(app)/settings/actions"
import toast from "react-hot-toast"

export default function SecurityForm() {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await changePasswordAction(fd)
    setSaving(false)
    if (result.ok) {
      toast.success("Password updated.")
      ;(e.target as HTMLFormElement).reset()
    } else {
      if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors)
      toast.error(result.error.error)
    }
  }

  return (
    <div>
      <PageHeader title="Security" subtitle="Update your password." />
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={!!fieldErrors["currentPassword"]}
              aria-describedby={fieldErrors["currentPassword"] ? "current-error" : undefined}
            />
            {fieldErrors["currentPassword"] && (
              <p id="current-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["currentPassword"]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              aria-invalid={!!fieldErrors["password"]}
              aria-describedby={fieldErrors["password"] ? "password-error" : undefined}
            />
            {fieldErrors["password"] && (
              <p id="password-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["password"]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              aria-invalid={!!fieldErrors["confirmPassword"]}
              aria-describedby={fieldErrors["confirmPassword"] ? "confirm-error" : undefined}
            />
            {fieldErrors["confirmPassword"] && (
              <p id="confirm-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["confirmPassword"]}
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
