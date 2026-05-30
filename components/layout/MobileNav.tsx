"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconLayoutDashboard,
  IconFolder,
  IconUsers,
  IconCreditCard,
  IconSettings,
  type TablerIcon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  match: string
  /** When the current path starts with this prefix the item is NOT highlighted. */
  excludePrefix?: string
  label: string
  icon: TablerIcon
}

const navItems: NavItem[] = [
  { href: "/dashboard", match: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/projects", match: "/projects", label: "Projects", icon: IconFolder },
  { href: "/team", match: "/team", label: "Team", icon: IconUsers },
  { href: "/settings/billing", match: "/settings/billing", label: "Billing", icon: IconCreditCard },
  {
    href: "/settings/profile",
    match: "/settings",
    excludePrefix: "/settings/billing",
    label: "Settings",
    icon: IconSettings,
  },
]

function isItemActive(pathname: string, match: string, excludePrefix?: string): boolean {
  if (excludePrefix && pathname.startsWith(excludePrefix)) return false
  return pathname === match || pathname.startsWith(`${match}/`)
}

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 flex items-stretch"
      style={{
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border-default)",
        height: 64,
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: "var(--z-mobile-nav)",
      }}
      aria-label="Mobile navigation"
    >
      {navItems.map(({ href, match, excludePrefix, label, icon: Icon }) => {
        const isActive = isItemActive(pathname, match, excludePrefix)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-120 relative",
              isActive ? "font-semibold" : "",
            )}
            style={{ color: isActive ? "var(--brand-primary)" : "var(--text-muted)" }}
            aria-current={isActive ? "page" : undefined}
            aria-label={label}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span
                className="absolute top-0 inset-x-3 h-0.5 rounded-b-full"
                style={{ background: "var(--brand-primary)" }}
              />
            )}
            <Icon size={20} aria-hidden="true" />
            <span className="text-[10px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
