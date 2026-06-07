import type { Metadata } from "next"
import { Suspense } from "react"
import LoginForm from "./LoginForm"

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your basekit workspace.",
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
