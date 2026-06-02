import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import TeamMembers from "@/components/team/TeamMembers"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("TeamMembers", () => {
  it("shows a skeleton, then renders the fetched roster", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        currentUserId: "owner-1",
        members: [
          { id: "m1", userId: "owner-1", role: "owner", joinedAt: "2026-01-01T00:00:00Z", displayName: "Ada", email: "ada@x.com", avatarUrl: null },
        ],
      }),
    }) as unknown as typeof fetch

    render(<TeamMembers />)
    expect(screen.getByTestId("member-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("Ada")).toBeInTheDocument()
    expect(screen.queryByTestId("member-skeleton")).not.toBeInTheDocument()
  })

  it("shows an error message when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch

    render(<TeamMembers />)

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load members/i))
  })
})
