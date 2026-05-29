"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const settingsNav = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/danger", label: "Danger zone" },
] as const

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="max-w-4xl mx-auto w-full">
      <h2
        className="text-2xl font-bold tracking-tight mb-6"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
      >
        Settings
      </h2>

      <div className="flex gap-8 flex-col lg:flex-row">
        {/* Settings sidebar */}
        <nav
          className="lg:w-48 shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0"
          aria-label="Settings navigation"
        >
          {settingsNav.map(({ href, label }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "shrink-0 px-3 py-2 rounded-lg text-sm transition-colors duration-120 whitespace-nowrap",
                  isActive ? "font-semibold" : "font-medium",
                )}
                style={
                  isActive
                    ? {
                        background: "var(--brand-bg-soft)",
                        color: "var(--brand-primary)",
                      }
                    : {
                        color: "var(--text-secondary)",
                      }
                }
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Settings content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
