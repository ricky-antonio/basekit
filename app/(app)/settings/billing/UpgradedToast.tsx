"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

// Fires the post-checkout success toast once, then strips `?upgraded=true` so a refresh
// doesn't re-toast. The ref guard + stable toast id keep it to a single toast even under
// React Strict Mode's double-invoked effects in development.
export default function UpgradedToast() {
  const router = useRouter()
  const hasFired = useRef(false)

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    toast.success("Welcome to Pro! Unlimited projects are now unlocked.", { id: "upgraded-to-pro" })
    router.replace("/settings/billing")
  }, [router])

  return null
}
