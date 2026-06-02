import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import RoleBadge from "@/components/team/RoleBadge"

describe("RoleBadge", () => {
  it("renders 'OWNER' in the brand color", () => {
    render(<RoleBadge role="owner" />)
    const badge = screen.getByText("OWNER")
    expect(badge).toHaveAttribute("data-role", "owner")
    expect(badge.getAttribute("style")).toContain("--brand-primary")
  })

  it("renders 'ADMIN' in the info color", () => {
    render(<RoleBadge role="admin" />)
    const badge = screen.getByText("ADMIN")
    expect(badge).toHaveAttribute("data-role", "admin")
    expect(badge.getAttribute("style")).toContain("--info-text")
  })

  it("renders 'MEMBER' in the neutral color", () => {
    render(<RoleBadge role="member" />)
    const badge = screen.getByText("MEMBER")
    expect(badge).toHaveAttribute("data-role", "member")
    expect(badge.getAttribute("style")).toContain("--text-secondary")
  })
})
