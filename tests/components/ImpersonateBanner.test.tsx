import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ImpersonateBanner from "@/components/admin/ImpersonateBanner"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ImpersonateBanner", () => {
  it("renders nothing when there is no impersonation context", () => {
    const { container } = render(<ImpersonateBanner context={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the banner with the target user's email when active", () => {
    render(
      <ImpersonateBanner context={{ targetUserId: "t1", targetEmail: "target@example.com" }} />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Impersonating")
    expect(screen.getByText("target@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /exit impersonation/i })).toBeInTheDocument()
  })

  it("clicking Exit calls the end-impersonation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
    // jsdom can't navigate — stub the location assignment the handler performs on success
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "" },
    })

    render(
      <ImpersonateBanner context={{ targetUserId: "t1", targetEmail: "target@example.com" }} />,
    )
    await userEvent.click(screen.getByRole("button", { name: /exit impersonation/i }))

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/impersonate/end", { method: "POST" })
  })
})
