import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/notifications"
import PageHeader from "@/components/shared/PageHeader"
import NotificationsForm from "./NotificationsForm"

export const metadata = { title: "Notification Settings — basekit" }

export default async function NotificationsSettingsPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const prefsResult = await getNotificationPreferences(authResult.data.id)
  const preferences = prefsResult.ok ? prefsResult.data : DEFAULT_NOTIFICATION_PREFERENCES

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Choose which emails basekit sends you." />
      <NotificationsForm initialPreferences={preferences} />
    </div>
  )
}
