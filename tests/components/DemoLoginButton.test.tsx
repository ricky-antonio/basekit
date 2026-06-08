import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import DemoLoginButton from "@/components/auth/DemoLoginButton"

vi.mock("@/app/(auth)/actions", () => ({ demoLoginAction: vi.fn() }))

describe("DemoLoginButton", () => {
  it("renders the default label as a submit button inside a form", () => {
    const { container } = render(<DemoLoginButton />)
    const button = screen.getByRole("button", { name: "Explore the demo" })
    expect(button).toHaveAttribute("type", "submit")
    const form = container.querySelector("form")
    expect(form).toBeInTheDocument()
    expect(form).toContainElement(button)
  })

  it("renders a custom label", () => {
    render(<DemoLoginButton label="Explore the demo — no signup" />)
    expect(screen.getByRole("button", { name: "Explore the demo — no signup" })).toBeInTheDocument()
  })
})
