import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import FeatureGrid from "@/components/marketing/FeatureGrid"

describe("FeatureGrid", () => {
  it("renders 6 feature cells", () => {
    render(<FeatureGrid />)
    expect(screen.getAllByRole("listitem")).toHaveLength(6)
  })

  it("each cell has an icon, title, description, and tech pill", () => {
    const { container } = render(<FeatureGrid />)
    const cells = screen.getAllByRole("listitem")

    for (const cell of cells) {
      // icon (Tabler renders an <svg>)
      expect(cell.querySelector("svg")).toBeInTheDocument()
      // title
      expect(cell.querySelector("h3")?.textContent?.length ?? 0).toBeGreaterThan(0)
      // description
      expect(cell.querySelector("p")?.textContent?.length ?? 0).toBeGreaterThan(0)
      // tech pill
      expect(cell.querySelector('[data-slot="tech-pill"]')).toBeInTheDocument()
    }

    expect(container.querySelectorAll('[data-slot="tech-pill"]')).toHaveLength(6)
  })
})
