import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import TopProgressBar, { startTopProgress } from "@/components/layout/TopProgressBar"

const mockPathname = vi.hoisted(() => ({ value: "/dashboard" }))
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
}))

const REVEAL_AND_A_BIT = 160 // just past the 120ms reveal delay

function clickAnchor(
  href: string,
  opts: { target?: string; download?: boolean } = {},
) {
  const anchor = document.createElement("a")
  anchor.setAttribute("href", href)
  if (opts.target) anchor.setAttribute("target", opts.target)
  if (opts.download) anchor.setAttribute("download", "")
  // Bubble-phase preventDefault keeps jsdom from attempting a real navigation; it runs
  // AFTER the component's capture-phase listener, so detection still happens.
  anchor.addEventListener("click", (e) => e.preventDefault())
  document.body.appendChild(anchor)
  act(() => {
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
  })
}

const bar = () => screen.queryByTestId("top-progress-bar")

describe("TopProgressBar", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockPathname.value = "/dashboard"
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("renders nothing while idle", () => {
    render(<TopProgressBar />)
    expect(bar()).toBeNull()
  })

  it("reveals the bar when a navigation is not instant", () => {
    render(<TopProgressBar />)
    clickAnchor("/projects")
    act(() => vi.advanceTimersByTime(REVEAL_AND_A_BIT))
    expect(bar()).toBeInTheDocument()
  })

  it("stays hidden when navigation completes before the reveal delay (instant)", () => {
    const { rerender } = render(<TopProgressBar />)
    clickAnchor("/projects")
    act(() => vi.advanceTimersByTime(50)) // before the 120ms reveal delay
    mockPathname.value = "/projects"
    rerender(<TopProgressBar />)
    act(() => vi.advanceTimersByTime(400))
    expect(bar()).toBeNull()
  })

  it("completes and fades out after the pathname changes", () => {
    const { rerender } = render(<TopProgressBar />)
    clickAnchor("/projects")
    act(() => vi.advanceTimersByTime(REVEAL_AND_A_BIT))
    expect(bar()).toBeInTheDocument()

    mockPathname.value = "/projects"
    rerender(<TopProgressBar />)
    act(() => vi.advanceTimersByTime(400)) // 100% then fade + hide
    expect(bar()).toBeNull()
  })

  it("ignores new-tab, download, external, and same-path clicks", () => {
    render(<TopProgressBar />)
    clickAnchor("/projects", { target: "_blank" })
    clickAnchor("/report.pdf", { download: true })
    clickAnchor("https://example.com")
    clickAnchor("/dashboard") // same as current pathname
    act(() => vi.advanceTimersByTime(400))
    expect(bar()).toBeNull()
  })

  it("reveals on browser back/forward (popstate)", () => {
    render(<TopProgressBar />)
    act(() => window.dispatchEvent(new PopStateEvent("popstate")))
    act(() => vi.advanceTimersByTime(REVEAL_AND_A_BIT))
    expect(bar()).toBeInTheDocument()
  })

  it("reveals when started programmatically (e.g. sign-out)", () => {
    render(<TopProgressBar />)
    act(() => startTopProgress())
    act(() => vi.advanceTimersByTime(REVEAL_AND_A_BIT))
    expect(bar()).toBeInTheDocument()
  })
})
