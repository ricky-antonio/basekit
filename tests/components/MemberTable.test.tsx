import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import toast from "react-hot-toast"
import MemberTable from "@/components/team/MemberTable"
import type { EnrichedMember } from "@/lib/team"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const owner: EnrichedMember = {
  id: "m-owner",
  userId: "owner-1",
  role: "owner",
  joinedAt: "2026-01-01T00:00:00Z",
  displayName: "Ada Owner",
  email: "owner@example.com",
  avatarUrl: null,
}
const bob: EnrichedMember = {
  id: "m-bob",
  userId: "bob-1",
  role: "member",
  joinedAt: "2026-02-01T00:00:00Z",
  displayName: "Bob Member",
  email: "bob@example.com",
  avatarUrl: null,
}

function mockFetch(ok: boolean, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("MemberTable", () => {
  it("renders each member with name, email, and role badge", () => {
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    expect(screen.getByText("Ada Owner")).toBeInTheDocument()
    expect(screen.getByText("owner@example.com")).toBeInTheDocument()
    expect(screen.getByText("Bob Member")).toBeInTheDocument()
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
    expect(screen.getByText("OWNER")).toBeInTheDocument()
    expect(screen.getByText("MEMBER")).toBeInTheDocument()
  })

  it("hides the Remove action for the owner row", () => {
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)
    expect(screen.queryByRole("button", { name: "Remove Ada Owner" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove Bob Member" })).toBeInTheDocument()
  })

  it("hides role + remove actions when the current user is a plain member", () => {
    render(<MemberTable members={[owner, bob]} currentUserId="bob-1" />)
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Make admin/ })).not.toBeInTheDocument()
  })

  it("opens the confirm dialog on remove click and only calls the API after confirm", async () => {
    const fetchMock = mockFetch(true)
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    await userEvent.click(screen.getByRole("button", { name: "Remove Bob Member" }))
    expect(screen.getByText("Remove member")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(fetchMock).toHaveBeenCalledWith("/api/team/remove", expect.objectContaining({ method: "DELETE" }))
  })

  it("optimistically removes the row when the server accepts", async () => {
    mockFetch(true)
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    await userEvent.click(screen.getByRole("button", { name: "Remove Bob Member" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.queryByText("Bob Member")).not.toBeInTheDocument())
  })

  it("restores the row and toasts when the server rejects the removal", async () => {
    mockFetch(false, { error: "Only owners can remove members.", code: "FORBIDDEN" })
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    await userEvent.click(screen.getByRole("button", { name: "Remove Bob Member" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.getByText("Bob Member")).toBeInTheDocument())
    expect(toast.error).toHaveBeenCalledWith("Only owners can remove members.")
  })

  it("optimistically promotes a member to admin", async () => {
    mockFetch(true)
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Make admin" }))

    await waitFor(() => expect(screen.getByText("ADMIN")).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith("/api/team/role", expect.objectContaining({ method: "PATCH" }))
  })

  it("reverts the role and toasts when the server rejects the change", async () => {
    mockFetch(false, { error: "Only owners can change roles.", code: "FORBIDDEN" })
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)

    await userEvent.click(screen.getByRole("button", { name: "Make admin" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only owners can change roles."))
    expect(screen.getByText("MEMBER")).toBeInTheDocument()
    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument()
  })

  it("renders rows that stack into a card layout on mobile", () => {
    render(<MemberTable members={[owner, bob]} currentUserId="owner-1" />)
    const rows = screen.getAllByTestId("member-row")
    expect(rows[0]?.className).toContain("flex-col")
  })
})
