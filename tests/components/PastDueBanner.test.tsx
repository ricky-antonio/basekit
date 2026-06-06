import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PastDueBanner from "@/components/billing/PastDueBanner"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

function mockFetch(ok: boolean, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom throws on real navigation — stub a writable location.
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
  })
})

describe("PastDueBanner", () => {
  it("renders nothing when status is active", () => {
    const { container } = render(<PastDueBanner status="active" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when there is no subscription", () => {
    const { container } = render(<PastDueBanner status={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a danger alert when status is past_due", () => {
    render(<PastDueBanner status="past_due" />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/last payment failed/i)).toBeInTheDocument()
  })

  it("CTA opens the billing portal", async () => {
    const fetchMock = mockFetch(true, { url: "https://stripe.test/portal/abc" })
    render(<PastDueBanner status="past_due" />)

    await userEvent.click(screen.getByRole("button", { name: "Update payment method" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/portal", expect.anything()))
    await waitFor(() => expect(window.location.href).toBe("https://stripe.test/portal/abc"))
  })

  it("shows the redirecting label and disables the button while loading", async () => {
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => {}
    global.fetch = vi.fn(
      () => new Promise((resolve) => { resolveFetch = resolve }),
    ) as unknown as typeof fetch

    render(<PastDueBanner status="past_due" />)
    await userEvent.click(screen.getByRole("button", { name: "Update payment method" }))

    const button = await screen.findByRole("button", { name: "Redirecting…" })
    expect(button).toBeDisabled()

    resolveFetch({ ok: true, json: async () => ({ url: "https://stripe.test/portal/abc" }) })
    await waitFor(() => expect(window.location.href).toBe("https://stripe.test/portal/abc"))
  })
})
