import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import UpgradePrompt from "@/components/billing/UpgradePrompt"
import type { ApiError } from "@/lib/types"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const limitError: ApiError = {
  error: "You've reached the project limit for your plan.",
  code: "LIMIT_EXCEEDED",
  upgradeUrl: "/settings/billing",
}

describe("UpgradePrompt", () => {
  it("renders nothing when there is no error", () => {
    const { container } = render(<UpgradePrompt error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the error code is not LIMIT_EXCEEDED", () => {
    const { container } = render(
      <UpgradePrompt error={{ error: "Nope", code: "VALIDATION_ERROR" }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the limit message and current plan when LIMIT_EXCEEDED", () => {
    render(<UpgradePrompt error={limitError} currentPlan="Free" />)
    expect(screen.getByText(/reached your plan limit/i)).toBeInTheDocument()
    expect(screen.getByText(/currently on the Free plan/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /upgrade plan/i })).toBeInTheDocument()
  })

  it("CTA href matches the provided upgradeUrl", () => {
    render(<UpgradePrompt error={limitError} currentPlan="Free" />)
    expect(screen.getByRole("link", { name: /upgrade plan/i })).toHaveAttribute(
      "href",
      "/settings/billing",
    )
  })

  it("falls back to /settings/billing when upgradeUrl is absent", () => {
    render(<UpgradePrompt error={{ error: "Limit", code: "LIMIT_EXCEEDED" }} />)
    expect(screen.getByRole("link", { name: /upgrade plan/i })).toHaveAttribute(
      "href",
      "/settings/billing",
    )
  })
})
