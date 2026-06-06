"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { IconFolderPlus, IconUserPlus, IconRocket, IconX } from "@tabler/icons-react"

export const WELCOME_DISMISSED_KEY = "basekit:welcome-dismissed"

const STEPS = [
  {
    icon: IconFolderPlus,
    title: "Create your first project",
    body: "Projects are where your work lives.",
    href: "/projects/new",
    cta: "New project",
  },
  {
    icon: IconUserPlus,
    title: "Invite a teammate",
    body: "Bring the rest of your team into your workspace.",
    href: "/team",
    cta: "Invite",
  },
  {
    icon: IconRocket,
    title: "Upgrade to Pro",
    body: "Unlock unlimited projects and more seats.",
    href: "/settings/billing",
    cta: "See plans",
  },
] as const

export default function WelcomeTour() {
  // Render nothing until we've confirmed the tour hasn't already been dismissed —
  // avoids a flash for returning users and keeps SSR output stable.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.localStorage.getItem(WELCOME_DISMISSED_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <section
      aria-labelledby="welcome-tour-heading"
      className="relative mb-6 rounded-xl p-6"
      style={{
        background: "var(--brand-bg-soft)",
        border: "1px solid var(--brand-border-soft)",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome tour"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--bg-surface-hover)]"
        style={{ color: "var(--text-muted)" }}
      >
        <IconX size={18} aria-hidden="true" />
      </button>

      <h2
        id="welcome-tour-heading"
        className="text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        Welcome to basekit
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Three quick steps to get your workspace going.
      </p>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body, href, cta }, index) => (
          <li
            key={href}
            className="flex flex-col rounded-lg p-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon size={18} aria-hidden="true" style={{ color: "var(--brand-primary)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Step {index + 1}
              </span>
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </h3>
            <p className="mt-1 flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {body}
            </p>
            <Link
              href={href}
              className="mt-3 inline-flex min-h-9 items-center text-sm font-medium"
              style={{ color: "var(--brand-primary)" }}
            >
              {cta} →
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
