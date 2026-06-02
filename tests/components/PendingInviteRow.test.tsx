import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import toast from "react-hot-toast"
import PendingInviteRow from "@/components/team/PendingInviteRow"
import type { PendingInvitation } from "@/lib/invitations"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))

const invitation: PendingInvitation = {
  id: "inv-1",
  email: "invitee@example.com",
  role: "admin",
  invitedBy: "owner-1",
  expiresAt: "2026-07-01T00:00:00Z",
  createdAt: "2026-06-01T00:00:00Z",
}

function mockFetch(ok: boolean, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PendingInviteRow", () => {
  it("renders the email, role, and sent date", () => {
    render(<PendingInviteRow invitation={invitation} />)
    expect(screen.getByText("invitee@example.com")).toBeInTheDocument()
    expect(screen.getByText("ADMIN")).toBeInTheDocument()
    expect(screen.getByText(/Invited/)).toBeInTheDocument()
  })

  it("revokes optimistically after confirming", async () => {
    mockFetch(true)
    render(<PendingInviteRow invitation={invitation} />)

    await userEvent.click(screen.getByRole("button", { name: /Revoke invitation for/ }))
    expect(global.fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Revoke" }))

    await waitFor(() => expect(screen.queryByText("invitee@example.com")).not.toBeInTheDocument())
    expect(refresh).toHaveBeenCalled()
  })

  it("restores the row and toasts on a server failure", async () => {
    mockFetch(false, { error: "Pending invitation not found.", code: "NOT_FOUND" })
    render(<PendingInviteRow invitation={invitation} />)

    await userEvent.click(screen.getByRole("button", { name: /Revoke invitation for/ }))
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }))

    await waitFor(() => expect(screen.getByText("invitee@example.com")).toBeInTheDocument())
    expect(toast.error).toHaveBeenCalledWith("Pending invitation not found.")
  })
})
