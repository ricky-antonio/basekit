"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconLayoutDashboard,
  IconFolder,
  IconUsers,
  IconCreditCard,
  IconSettings,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", match: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/projects", match: "/projects", label: "Projects", icon: IconFolder },
  { href: "/team", match: "/team", label: "Team", icon: IconUsers },
  { href: "/billing", match: "/billing", label: "Billing", icon: IconCreditCard },
  { href: "/settings/profile", match: "/settings", label: "Settings", icon: IconSettings },
] as const

function isItemActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`)
}

interface SidebarProps {
  workspaceName: string
}

export default function Sidebar({ workspaceName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="hidden lg:flex flex-col h-full"
      style={{
        width: 240,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-default)",
        zIndex: "var(--z-sidebar)",
      }}
      aria-label="Sidebar navigation"
    >
      {/* Wordmark */}
      <div
        className="flex items-center h-14 px-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <Link href="/dashboard" className="text-base tracking-tight select-none">
          <span className="font-normal" style={{ color: "var(--text-primary)" }}>
            base
          </span>
          <span
            className="font-extrabold"
            style={{ color: "var(--brand-primary)", letterSpacing: "-0.02em" }}
          >
            kit
          </span>
        </Link>
      </div>

      {/* Workspace name */}
      <div className="px-4 pt-4 pb-2">
        <p
          className="text-xs font-semibold uppercase tracking-widest truncate"
          style={{ color: "var(--text-muted)" }}
          title={workspaceName}
        >
          {workspaceName}
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 pb-4 space-y-0.5" role="navigation">
        {navItems.map(({ href, match, label, icon: Icon }) => {
          const isActive = isItemActive(pathname, match)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm transition-colors duration-120",
                isActive
                  ? "font-semibold"
                  : "font-medium hover:bg-[var(--bg-surface-hover)]",
              )}
              style={
                isActive
                  ? {
                      background: "var(--brand-bg-soft)",
                      color: "var(--brand-primary)",
                      borderLeft: "3px solid var(--brand-primary)",
                      paddingLeft: "9px", // compensate for 3px border
                    }
                  : { color: "var(--text-secondary)" }
              }
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
