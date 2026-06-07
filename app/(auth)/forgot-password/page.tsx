import type { Metadata } from "next"
import { Suspense } from "react"
import ForgotPasswordForm from "./ForgotPasswordForm"

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your basekit password.",
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
