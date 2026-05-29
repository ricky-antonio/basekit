"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { IconSun, IconMoon, IconSettings, IconLogout, IconUser, IconLoader2 } from "@tabler/icons-react"
import { startTopProgress } from "@/components/layout/TopProgressBar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutAction } from "@/app/(auth)/actions"
import toast from "react-hot-toast"
import Link from "next/link"

interface TopbarProps {
  workspaceName: string
  displayName: string
  avatarUrl?: string | null
}

export default function Topbar({ workspaceName, displayName, avatarUrl }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [signingOut, setSigningOut] = useState(false)

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    startTopProgress()
    try {
      await signOutAction()
      // redirect throws; this line is only reached on unexpected failure
    } catch (error) {
      // Next's redirect throw is rethrown by RSC machinery and triggers navigation,
      // so it won't actually surface here. A real error means signOut failed.
      const isRedirect = (error as { digest?: string } | null)?.digest?.startsWith("NEXT_REDIRECT")
      if (isRedirect) throw error
      toast.error("Could not sign out. Please try again.")
      setSigningOut(false)
    }
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <header
      className="flex items-center justify-between px-4 lg:px-6 shrink-0"
      style={{
        height: 56,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
        zIndex: "var(--z-topbar)",
      }}
    >
      {/* Workspace name (visible on mobile where sidebar is hidden) */}
      <span
        className="lg:hidden text-sm font-semibold truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {workspaceName}
      </span>
      {/* Spacer on desktop — sidebar already shows name */}
      <div className="hidden lg:block" />

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-lg px-2 py-2 min-h-11 transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
          aria-label="User menu"
          disabled={signingOut}
        >
          <Avatar className="h-7 w-7">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback
              className="text-xs font-semibold"
              style={{ background: "var(--brand-bg-soft)", color: "var(--brand-primary)" }}
            >
              {initials || <IconUser size={14} />}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {displayName}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2 cursor-pointer">
              <IconSettings size={15} aria-hidden="true" />
              Settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleTheme}
          >
            {resolvedTheme === "dark" ? (
              <IconSun size={15} aria-hidden="true" />
            ) : (
              <IconMoon size={15} aria-hidden="true" />
            )}
            {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            onSelect={(event) => {
              // Keep the menu open so the "Signing out…" spinner is visible during
              // the Server Action + redirect, instead of closing into a silent wait.
              event.preventDefault()
              void handleSignOut()
            }}
            disabled={signingOut}
          >
            {signingOut ? (
              <IconLoader2 size={15} aria-hidden="true" className="animate-spin" />
            ) : (
              <IconLogout size={15} aria-hidden="true" />
            )}
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
