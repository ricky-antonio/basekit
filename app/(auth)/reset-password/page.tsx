import { redirect } from "next/navigation"
import { getUser } from "@/lib/auth"
import { ResetPasswordForm } from "./ResetPasswordForm"

export default async function ResetPasswordPage() {
  // The Supabase password-recovery flow lands here with an active session
  // (granted by /callback). No session = link missing / expired / used /
  // direct visit. Send the user back to start the flow again.
  const user = await getUser()
  if (!user) redirect("/forgot-password?error=link_expired")

  return <ResetPasswordForm />
}
