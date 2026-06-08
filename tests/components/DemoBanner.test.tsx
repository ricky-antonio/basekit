import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import DemoBanner from "@/components/layout/DemoBanner"

describe("DemoBanner", () => {
  it("renders nothing for a real account", () => {
    const { container } = render(<DemoBanner email="rickyantonio.codes@gmail.com" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when email is null", () => {
    const { container } = render(<DemoBanner email={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the demo notice for a demo account", () => {
    render(<DemoBanner email="demo@demo.basekit.test" />)
    expect(screen.getByRole("status")).toHaveTextContent(/basekit demo/i)
    expect(screen.getByText(/resets nightly/i)).toBeInTheDocument()
  })
})
