import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UserDetailHeader from "@/components/admin/UserDetailHeader"
import type { AdminUserDetail } from "@/lib/admin"

function detail(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    userId: "u1",
    email: "alice@example.com",
    displayName: "Alice Admin",
    avatarUrl: null,
    role: "user",
    workspace: { id: "ws-1", name: "Acme", slug: "acme", createdAt: "2026-01-01T00:00:00Z" },
    subscription: {
      planName: "pro",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: "2026-07-01T00:00:00Z",
      stripeCustomerId: "cus_1",
    },
    recentActivity: [],
    ...overrides,
  }
}

describe("UserDetailHeader", () => {
  it("renders name, email, plan badge, and status badge", () => {
    render(<UserDetailHeader detail={detail()} onOverride={vi.fn()} onImpersonate={vi.fn()} impersonating={false} />)
    expect(screen.getByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("shows an Admin badge only for admin-role users", () => {
    const { rerender } = render(<UserDetailHeader detail={detail({ role: "user" })} onOverride={vi.fn()} onImpersonate={vi.fn()} impersonating={false} />)
    expect(screen.queryByText("Admin")).not.toBeInTheDocument()
    rerender(<UserDetailHeader detail={detail({ role: "admin" })} onOverride={vi.fn()} onImpersonate={vi.fn()} impersonating={false} />)
    expect(screen.getByText("Admin")).toBeInTheDocument()
  })

  it("falls back to a Free badge when there is no subscription", () => {
    render(<UserDetailHeader detail={detail({ subscription: null })} onOverride={vi.fn()} onImpersonate={vi.fn()} impersonating={false} />)
    expect(screen.getByText("Free")).toBeInTheDocument()
  })

  it("calls onOverride when the Override plan button is clicked", async () => {
    const onOverride = vi.fn()
    render(<UserDetailHeader detail={detail()} onOverride={onOverride} onImpersonate={vi.fn()} impersonating={false} />)
    await userEvent.click(screen.getByRole("button", { name: "Override plan" }))
    expect(onOverride).toHaveBeenCalledOnce()
  })

  it("calls onImpersonate when the Impersonate button is clicked", async () => {
    const onImpersonate = vi.fn()
    render(<UserDetailHeader detail={detail()} onOverride={vi.fn()} onImpersonate={onImpersonate} impersonating={false} />)
    await userEvent.click(screen.getByRole("button", { name: "Impersonate" }))
    expect(onImpersonate).toHaveBeenCalledOnce()
  })

  it("shows a pending label and disables the button while impersonating", () => {
    render(<UserDetailHeader detail={detail()} onOverride={vi.fn()} onImpersonate={vi.fn()} impersonating={true} />)
    const button = screen.getByRole("button", { name: "Impersonating…" })
    expect(button).toBeDisabled()
  })
})
