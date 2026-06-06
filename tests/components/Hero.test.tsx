import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import Hero from "@/components/marketing/Hero"

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

  it("Explore demo button links to /login", () => {
    render(<Hero />)
    expect(screen.getByRole("link", { name: /explore the demo/i })).toHaveAttribute("href", "/login")
  })

  it("shows a social-proof count", () => {
    render(<Hero />)
    expect(screen.getByText(/1,200\+/)).toBeInTheDocument()
  })
})
