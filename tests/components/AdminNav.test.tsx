import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import AdminNav from "@/components/admin/AdminNav"

const mocks = vi.hoisted(() => ({ pathname: "/admin" }))
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }))

describe("AdminNav", () => {
  it("renders all admin sections plus a back-to-app link", () => {
    mocks.pathname = "/admin"
    render(<AdminNav />)
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Subscriptions" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Activity" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Back to app/i })).toHaveAttribute("href", "/dashboard")
  })

  it("marks Overview active only on the exact /admin path", () => {
    mocks.pathname = "/admin"
    render(<AdminNav />)
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Users" })).not.toHaveAttribute("aria-current")
  })

  it("marks Users active on a nested user-detail path", () => {
    mocks.pathname = "/admin/users/abc-123"
    render(<AdminNav />)
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current")
  })
})
