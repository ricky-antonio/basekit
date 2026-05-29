"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

// Only reveal the bar if a navigation takes longer than this — instant (cached) view
// switches stay flash-free, matching "show it any time loading is not instant".
const REVEAL_DELAY_MS = 120
const TRICKLE_MS = 200
const SAFETY_MS = 8000
const FADE_MS = 300

export const TOP_PROGRESS_START_EVENT = "basekit:top-progress-start"

// Manually start the global bar for programmatic navigation that isn't an anchor
// click (e.g. sign-out, which runs a Server Action + redirect).
export function startTopProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOP_PROGRESS_START_EVENT))
  }
}

export default function TopProgressBar() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const runningRef = useRef(false)
  const shownRef = useRef(false)
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>
    trickle?: ReturnType<typeof setInterval>
    safety?: ReturnType<typeof setTimeout>
    hide?: ReturnType<typeof setTimeout>
  }>({})

  const complete = useCallback(() => {
    if (!runningRef.current) return
    runningRef.current = false
    clearTimeout(timers.current.delay)
    clearInterval(timers.current.trickle)
    clearTimeout(timers.current.safety)
    if (shownRef.current) {
      setProgress(100)
      timers.current.hide = setTimeout(() => {
        shownRef.current = false
        setProgress(0)
      }, FADE_MS)
    } else {
      // Completed before the reveal delay — it was instant, so never flash the bar.
      setProgress(0)
    }
  }, [])

  const start = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    clearTimeout(timers.current.hide)
    timers.current.delay = setTimeout(() => {
      shownRef.current = true
      setProgress(8)
      timers.current.trickle = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : Math.min(90, p + (90 - p) * 0.1 + 0.4)))
      }, TRICKLE_MS)
    }, REVEAL_DELAY_MS)
    timers.current.safety = setTimeout(complete, SAFETY_MS)
  }, [complete])

  // The codebase uses <Link> (renders <a>) for all nav and bans router.push, so
  // intercepting same-origin anchor clicks reliably covers every view switch.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return
      if (!href.startsWith("/") || href.startsWith("//")) return

      let destination: URL
      try {
        destination = new URL(href, window.location.origin)
      } catch {
        return
      }
      if (destination.pathname === pathname) return
      start()
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", start)
    window.addEventListener(TOP_PROGRESS_START_EVENT, start)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", start)
      window.removeEventListener(TOP_PROGRESS_START_EVENT, start)
    }
  }, [pathname, start])

  // A pathname change means the navigation that started the bar has landed.
  useEffect(() => {
    complete()
  }, [pathname, complete])

  useEffect(() => {
    const t = timers.current
    return () => {
      clearTimeout(t.delay)
      clearInterval(t.trickle)
      clearTimeout(t.safety)
      clearTimeout(t.hide)
    }
  }, [])

  if (progress === 0) return null

  return (
    <div
      aria-hidden="true"
      data-testid="top-progress-bar"
      className="top-progress-bar"
      style={{ width: `${progress}%`, opacity: progress >= 100 ? 0 : 1 }}
    />
  )
}
