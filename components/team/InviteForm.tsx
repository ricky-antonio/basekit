"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import UpgradePrompt from "@/components/billing/UpgradePrompt"
import type { ApiError } from "@/lib/types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface InviteFormProps {
  currentPlanLabel?: string
}

export default function InviteForm({ currentPlanLabel }: InviteFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [submitting, setSubmitting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<ApiError | null>(null)

  function validateEmail() {
    if (email && !EMAIL_RE.test(email)) {
      setEmailError("Enter a valid email address")
      return false
    }
    setEmailError(null)
    return true
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setLimitError(null)
    if (!validateEmail()) {
      setSubmitting(false)
      return
    }
    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      if (response.ok) {
        toast.success(`Invitation sent to ${email}.`)
        setEmail("")
        setRole("member")
        setEmailError(null)
        router.refresh()
        return
      }
      const error: ApiError = await response
        .json()
        .catch(() => ({ error: "Could not send the invitation. Please try again.", code: "INTERNAL_ERROR" as const }))
      if (error.code === "LIMIT_EXCEEDED") {
        setLimitError(error)
      } else if (error.code === "VALIDATION_ERROR" && error.fieldErrors?.["email"]) {
        setEmailError(error.fieldErrors["email"])
      } else {
        toast.error(error.error)
      }
    } catch {
      toast.error("Could not send the invitation. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            onBlur={validateEmail}
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "invite-email-error" : undefined}
          />
          {emailError && (
            <p id="invite-email-error" className="text-xs" style={{ color: "var(--danger-text)" }}>
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="h-9 min-h-9 w-full rounded-md px-2.5 text-sm sm:w-32"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <Button type="submit" disabled={submitting} className="min-h-9 sm:w-auto">
          {submitting ? "Inviting…" : "Send invitation"}
        </Button>
      </form>

      <UpgradePrompt error={limitError} currentPlan={currentPlanLabel} />
    </div>
  )
}
