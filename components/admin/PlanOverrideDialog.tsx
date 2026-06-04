"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PlanName } from "@/lib/types"

interface PlanOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: PlanName
  onConfirm: (plan: PlanName, reason: string) => void | Promise<void>
}

const PLAN_OPTIONS: { value: PlanName; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
]

// A manual plan override bypasses Stripe, so it's deliberately friction-ful: the admin
// must pick a target plan and write a reason (audited) before Confirm enables.
export default function PlanOverrideDialog({ open, onOpenChange, currentPlan, onConfirm }: PlanOverrideDialogProps) {
  const [plan, setPlan] = useState<PlanName | "">("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  // Start each open from a clean slate so a previous attempt's values don't leak in.
  useEffect(() => {
    if (open) {
      setPlan("")
      setReason("")
      setSaving(false)
    }
  }, [open])

  const canConfirm = plan !== "" && reason.trim().length > 0 && !saving

  async function handleConfirm() {
    if (plan === "" || reason.trim().length === 0) return
    setSaving(true)
    try {
      await onConfirm(plan, reason.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override plan</DialogTitle>
          <DialogDescription>
            Manually set this workspace&apos;s plan, bypassing Stripe. Use this for comped or manual
            plans. The change is recorded in the activity log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="override-plan">New plan</Label>
            <select
              id="override-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as PlanName)}
              className="h-9 min-h-9 w-full rounded-md px-2.5 text-sm"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="" disabled>
                Select a plan
              </option>
              {PLAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.value === currentPlan ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason">Reason</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Comped for design-partner program"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {saving ? "Saving…" : "Confirm override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
