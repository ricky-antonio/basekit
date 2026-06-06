import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import WelcomeTour, { WELCOME_DISMISSED_KEY } from "@/components/dashboard/WelcomeTour"

beforeEach(() => {
  window.localStorage.clear()
})

describe("WelcomeTour", () => {
  it("renders the three steps when not previously dismissed", async () => {
    render(<WelcomeTour />)

    expect(await screen.findByRole("heading", { name: "Welcome to basekit" })).toBeInTheDocument()
    expect(screen.getByText("Create your first project")).toBeInTheDocument()
    expect(screen.getByText("Invite a teammate")).toBeInTheDocument()
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument()
  })

  it("hides on dismiss and writes the flag to localStorage", async () => {
    render(<WelcomeTour />)

    const dismiss = await screen.findByRole("button", { name: "Dismiss welcome tour" })
    await userEvent.click(dismiss)

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Welcome to basekit" })).not.toBeInTheDocument(),
    )
    expect(window.localStorage.getItem(WELCOME_DISMISSED_KEY)).toBe("1")
  })

  it("does not render when the dismissed flag is already set", async () => {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1")
    const { container } = render(<WelcomeTour />)

    // Give the mount effect a tick; it should leave the DOM empty.
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
