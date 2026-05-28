import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAuth()
  if (!result.ok) redirect("/login")
  return <>{children}</>
}
