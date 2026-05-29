"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/shared/PageHeader"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import { deleteAccountAction } from "@/app/(app)/settings/actions"
import toast from "react-hot-toast"

export default function DangerZone() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteAccountAction()
    // deleteAccountAction redirects on success; if we get here it failed
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.error)
    }
  }

  return (
    <div>
      <PageHeader title="Danger zone" subtitle="Irreversible actions. Proceed with caution." />

      <section
        className="rounded-xl p-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--danger-border, #FECACA)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Delete account
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={deleting}
            aria-label="Delete account"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Delete account"
        description="This will permanently delete your account and all associated data. There is no undo."
        confirmLabel="Yes, delete my account"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
