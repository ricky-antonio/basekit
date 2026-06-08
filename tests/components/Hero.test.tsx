import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import Hero from "@/components/marketing/Hero"

// Hero's demo CTA is a form bound to a server action — mock it out of the client render.
vi.mock("@/app/(auth)/actions", () => ({ demoLoginAction: vi.fn() }))

describe("Hero", () => {
  it("renders the hero headline", () => {
    render(<Hero />)
    expect(
      screen.getByRole("heading", { name: /the foundation every saas needs to ship/i }),
    ).toBeInTheDocument()
  })

  it("Get started button links to /signup", () => {
    render(<Hero />)
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/signup")
  })

  it("renders the one-click demo CTA as a submit button", () => {
    render(<Hero />)
    const demo = screen.getByRole("button", { name: /explore the demo/i })
    expect(demo).toHaveAttribute("type", "submit")
  })

  it("shows a social-proof count", () => {
    render(<Hero />)
    expect(screen.getByText(/1,200\+/)).toBeInTheDocument()
  })
})
