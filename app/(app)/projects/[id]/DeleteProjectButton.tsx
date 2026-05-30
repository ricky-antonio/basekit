"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/shared/ConfirmDialog"
import { deleteProjectAction } from "@/app/(app)/projects/actions"
import { IconTrash } from "@tabler/icons-react"
import toast from "react-hot-toast"

interface DeleteProjectButtonProps {
  projectId: string
  projectName: string
}

export default function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    try {
      const result = await deleteProjectAction(projectId)
      // The success path redirects (throws NEXT_REDIRECT); only failures return here.
      if (!result.ok) {
        toast.error(result.error.error)
        setOpen(false)
      }
    } catch (error) {
      const isRedirect = (error as { digest?: string } | null)?.digest?.startsWith("NEXT_REDIRECT")
      if (isRedirect) throw error
      toast.error("Could not delete the project. Please try again.")
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 min-h-11"
      >
        <IconTrash size={16} aria-hidden="true" />
        Delete project
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete project"
        description={`This permanently deletes “${projectName}.” This action cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        onConfirm={handleDelete}
      />
    </>
  )
}
