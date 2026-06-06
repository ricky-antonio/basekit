import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import Testimonials from "@/components/marketing/Testimonials"

describe("Testimonials", () => {
  it("renders three quotes", () => {
    const { container } = render(<Testimonials />)
    expect(container.querySelectorAll("blockquote")).toHaveLength(3)
  })

  it("each quote has an avatar with initials and a role label", () => {
    const { container } = render(<Testimonials />)
    const figures = container.querySelectorAll("figure")
    expect(figures).toHaveLength(3)

    for (const figure of figures) {
      const caption = figure.querySelector("figcaption")
      expect(caption).toBeInTheDocument()
      // avatar initials (2 uppercase letters) + a role label
      expect(caption?.textContent).toMatch(/[A-Z]{2}/)
    }

    // Role labels, no fabricated names
    expect(screen.getByText(/founding engineer/i)).toBeInTheDocument()
    expect(screen.getByText(/staff engineer/i)).toBeInTheDocument()
    expect(screen.getByText(/CTO, dev-tools startup/i)).toBeInTheDocument()
  })
})
