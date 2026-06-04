"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

// Rendered by the dashboard only when it lands with `?error=admin_required` (a non-admin
// bounced from the admin section). Fires once, then strips the param so a refresh doesn't
// re-toast — mirrors UpgradedToast.
export default function AdminRequiredToast() {
  const router = useRouter()
  const hasFired = useRef(false)

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    toast.error("Admin access required.", { id: "admin-required" })
    router.replace("/dashboard")
  }, [router])

  return null
}
