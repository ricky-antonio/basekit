"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import UpgradePrompt from "@/components/billing/UpgradePrompt"
import { createProjectAction } from "@/app/(app)/projects/actions"
import type { ApiError } from "@/lib/types"
import toast from "react-hot-toast"

interface NewProjectFormProps {
  currentPlan: string
}

export default function NewProjectForm({ currentPlan }: NewProjectFormProps) {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [limitError, setLimitError] = useState<ApiError | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setLimitError(null)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await createProjectAction(formData)
      // The success path redirects (throws NEXT_REDIRECT); only failures return here.
      if (!result.ok) {
        setSaving(false)
        if (result.error.code === "LIMIT_EXCEEDED") {
          setLimitError(result.error)
        } else {
          if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors)
          toast.error(result.error.error)
        }
      }
    } catch (error) {
      const isRedirect = (error as { digest?: string } | null)?.digest?.startsWith("NEXT_REDIRECT")
      if (isRedirect) throw error
      setSaving(false)
      toast.error("Something went wrong. Please try again.")
    }
  }

  return (
    <div className="space-y-5">
      <UpgradePrompt error={limitError} currentPlan={currentPlan} />

      <section
        className="rounded-xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              name="name"
              maxLength={64}
              required
              autoFocus
              placeholder="My new project"
              aria-invalid={!!fieldErrors["name"]}
              aria-describedby={fieldErrors["name"] ? "name-error" : undefined}
            />
            {fieldErrors["name"] && (
              <p id="name-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["name"]}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              name="description"
              maxLength={500}
              rows={4}
              placeholder="What is this project for?"
              aria-invalid={!!fieldErrors["description"]}
              aria-describedby={fieldErrors["description"] ? "description-error" : undefined}
            />
            {fieldErrors["description"] && (
              <p id="description-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["description"]}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/projects">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
