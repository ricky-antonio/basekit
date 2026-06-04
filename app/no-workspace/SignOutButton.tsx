"use client"

import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"

// Submit button for the /no-workspace sign-out form. useFormStatus surfaces the
// pending state of the parent <form action={signOutAction}> — the page redirects to
// /login when it resolves, so the label never resets (matches the redirect-button rule).
export default function SignOutButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="min-h-11 w-full">
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  )
}
