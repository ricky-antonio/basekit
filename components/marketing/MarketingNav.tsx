"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { IconMenu2, IconX, IconBrandGithub } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import Wordmark from "@/components/marketing/Wordmark"
import ThemeToggle from "@/components/marketing/ThemeToggle"

const GITHUB_URL = "https://github.com"

const NAV_LINKS = [
  { label: "Features", href: "/#features", external: false },
  { label: "Pricing", href: "/pricing", external: false },
  { label: "Docs", href: GITHUB_URL, external: true },
  { label: "GitHub", href: GITHUB_URL, external: true },
] as const

export default function MarketingNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <header
      className="sticky top-0 z-30 w-full"
      style={{
        background: "var(--bg-app)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Wordmark />

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md"
            style={{ color: "var(--text-primary)" }}
          >
            {open ? <IconX size={20} aria-hidden="true" /> : <IconMenu2 size={20} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden"
          style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-app)" }}
        >
          <ul className="flex flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {link.label === "GitHub" && <IconBrandGithub size={16} aria-hidden="true" />}
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 flex flex-col gap-2">
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/signup" onClick={() => setOpen(false)}>
                  Get started
                </Link>
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
