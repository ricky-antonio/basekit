"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconArrowLeft } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface AdminNavItem {
  href: string
  label: string
  exact?: boolean
}

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/activity", label: "Activity" },
]

function isActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <div
      className="mb-8 flex flex-col gap-4 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border-default)" }}
    >
      <nav className="-mb-3 flex gap-1 overflow-x-auto" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "min-h-11 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                active ? "font-semibold" : "font-medium",
              )}
              style={
                active
                  ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }
                  : { borderColor: "transparent", color: "var(--text-secondary)" }
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium sm:self-auto"
        style={{ color: "var(--text-secondary)" }}
      >
        <IconArrowLeft size={15} aria-hidden="true" />
        Back to app
      </Link>
    </div>
  )
}
