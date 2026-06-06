"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { updateNotificationPreferencesAction } from "@/app/(app)/settings/actions"
import { NOTIFICATION_KINDS, type NotificationKind, type NotificationPreferences } from "@/lib/types"

const NOTIFICATION_META: Record<NotificationKind, { label: string; description: string }> = {
  weekly_digest: {
    label: "Weekly digest",
    description: "A summary of your workspace activity, delivered every Monday.",
  },
  payment_failed: {
    label: "Payment failures",
    description: "Alerts when a payment fails so you can fix it before losing access.",
  },
  trial_ending: {
    label: "Trial reminders",
    description: "A heads-up three days before your Pro trial ends.",
  },
  member_joined: {
    label: "New members",
    description: "When a teammate accepts an invitation and joins your workspace.",
  },
  plan_changes: {
    label: "Plan changes",
    description: "Confirmation when your subscription plan changes.",
  },
}

function isDirty(a: NotificationPreferences, b: NotificationPreferences): boolean {
  return NOTIFICATION_KINDS.some((kind) => a[kind] !== b[kind])
}

interface NotificationsFormProps {
  initialPreferences: NotificationPreferences
}

export default function NotificationsForm({ initialPreferences }: NotificationsFormProps) {
  const [saved, setSaved] = useState(initialPreferences)
  const [draft, setDraft] = useState(initialPreferences)
  const [saving, setSaving] = useState(false)

  const dirty = isDirty(saved, draft)

  function toggle(kind: NotificationKind, value: boolean) {
    setDraft((prev) => ({ ...prev, [kind]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateNotificationPreferencesAction(draft)
      if (result.ok) {
        setSaved(result.data)
        setDraft(result.data)
        toast.success("Notification preferences saved.")
      } else {
        toast.error(result.error.error)
      }
    } catch {
      toast.error("Could not save notification preferences. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <ul className="divide-y" style={{ borderColor: "var(--border-default)" }}>
        {NOTIFICATION_KINDS.map((kind) => {
          const meta = NOTIFICATION_META[kind]
          return (
            <li key={kind} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <label
                  htmlFor={`notify-${kind}`}
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {meta.label}
                </label>
                <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {meta.description}
                </p>
              </div>
              <Switch
                id={`notify-${kind}`}
                checked={draft[kind]}
                onCheckedChange={(value) => toggle(kind, value)}
                aria-label={meta.label}
              />
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
