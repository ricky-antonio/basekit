import PageHeader from "@/components/shared/PageHeader"

export const metadata = { title: "Notification Settings — basekit" }

export default function NotificationsSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Manage your notification preferences."
      />
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Notification preferences are coming soon. Check back in a later update.
        </p>
      </div>
    </div>
  )
}
