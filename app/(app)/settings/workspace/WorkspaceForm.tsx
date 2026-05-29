"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PageHeader from "@/components/shared/PageHeader"
import { updateWorkspaceAction } from "@/app/(app)/settings/actions"
import toast from "react-hot-toast"

interface WorkspaceFormProps {
  initialName: string
  initialSlug: string
}

export default function WorkspaceForm({ initialName, initialSlug }: WorkspaceFormProps) {
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})
    const fd = new FormData(e.currentTarget)
    const result = await updateWorkspaceAction(fd)
    setSaving(false)
    if (result.ok) {
      toast.success("Workspace updated.")
    } else {
      if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors)
      toast.error(result.error.error)
    }
  }

  return (
    <div>
      <PageHeader title="Workspace" subtitle="Update your workspace name and URL slug." />
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
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
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              maxLength={48}
              required
              aria-invalid={!!fieldErrors["slug"]}
              aria-describedby={fieldErrors["slug"] ? "slug-error" : undefined}
            />
            {fieldErrors["slug"] && (
              <p id="slug-error" className="text-xs" style={{ color: "var(--danger-text, #DC2626)" }}>
                {fieldErrors["slug"]}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
