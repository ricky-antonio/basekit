import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { getProfile } from "@/lib/profile"
import ProfileForm from "./ProfileForm"

export const metadata = { title: "Profile Settings — basekit" }

export default async function ProfileSettingsPage() {
  const authResult = await requireAuth()
  if (!authResult.ok) redirect("/login")

  const profileResult = await getProfile(authResult.data.id)
  const profile = profileResult.ok ? profileResult.data : null
  // Empty-string fallback (not "User") so the input shows blank for new accounts.
  const displayName =
    profile?.display_name ??
    (authResult.data.user_metadata as { display_name?: string } | undefined)?.display_name ??
    ""
  const avatarUrl = profile?.avatar_url ?? null
  const email = authResult.data.email ?? ""

  return (
    <ProfileForm
      displayName={displayName}
      avatarUrl={avatarUrl}
      email={email}
    />
  )
}
