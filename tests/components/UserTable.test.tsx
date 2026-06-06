import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UserTable from "@/components/admin/UserTable"
import type { AdminUserList, AdminUserRow } from "@/lib/admin"

const mocks = vi.hoisted(() => ({ push: vi.fn(), params: "" }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.params),
}))

function user(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    userId: "u1",
    email: "alice@example.com",
    displayName: "Alice Admin",
    avatarUrl: null,
    role: "user",
    workspaceId: "ws-1",
    workspaceName: "Acme",
    workspaceSlug: "acme",
    planName: "pro",
    status: "active",
    stripeCustomerId: "cus_1",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function mockFetch(list: AdminUserList) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => list }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.params = ""
})

describe("UserTable", () => {
  it("renders a row with name, email, and plan badge after fetching", async () => {
    mockFetch({ users: [user()], total: 1, page: 1, pageSize: 20 })
    render(<UserTable />)
    expect(screen.getByTestId("user-table-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    // "Pro" also appears in the plan filter <option>, so scope to the row badge.
    const row = screen.getByTestId("user-row")
    expect(within(row).getByText("Pro")).toBeInTheDocument()
    expect(row).toHaveAttribute("href", "/admin/users/u1")
  })

  it("navigates to the next page via the pagination control", async () => {
    mockFetch({ users: [user(), user({ userId: "u2", displayName: "Bob" })], total: 40, page: 1, pageSize: 20 })
    render(<UserTable />)
    await screen.findByText("Alice Admin")

    await userEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(mocks.push).toHaveBeenCalledWith("/admin/users?page=2")
  })

  it("updates the URL on search submit and resets the page", async () => {
    mocks.params = "page=3"
    mockFetch({ users: [user()], total: 1, page: 3, pageSize: 20 })
    render(<UserTable />)
    await screen.findByText("Alice Admin")

    await userEvent.type(screen.getByLabelText("Search users"), "bob")
    await userEvent.keyboard("{Enter}")
    expect(mocks.push).toHaveBeenCalledWith("/admin/users?search=bob")
  })

  it("debounces typed input into the URL (live search) and resets the page", async () => {
    vi.useFakeTimers()
    try {
      mocks.params = "page=2"
      mockFetch({ users: [user()], total: 1, page: 2, pageSize: 20 })
      render(<UserTable />)

      fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "bob" } })
      expect(mocks.push).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(300)
      expect(mocks.push).toHaveBeenCalledWith("/admin/users?search=bob")
    } finally {
      vi.useRealTimers()
    }
  })

  it("clearing the search field resets the URL", async () => {
    vi.useFakeTimers()
    try {
      mocks.params = "search=bob"
      mockFetch({ users: [user()], total: 1, page: 1, pageSize: 20 })
      render(<UserTable />)

      fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "" } })
      await vi.advanceTimersByTimeAsync(300)
      expect(mocks.push).toHaveBeenCalledWith("/admin/users?")
    } finally {
      vi.useRealTimers()
    }
  })

  it("updates the URL when the plan filter changes", async () => {
    mockFetch({ users: [user()], total: 1, page: 1, pageSize: 20 })
    render(<UserTable />)
    await screen.findByText("Alice Admin")

    await userEvent.selectOptions(screen.getByLabelText("Filter by plan"), "pro")
    expect(mocks.push).toHaveBeenCalledWith("/admin/users?plan=pro")
  })

  it("shows an empty state when no users match", async () => {
    mockFetch({ users: [], total: 0, page: 1, pageSize: 20 })
    render(<UserTable />)
    await waitFor(() => expect(screen.getByText(/No users match these filters/i)).toBeInTheDocument())
  })

  it("shows an error message when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch
    render(<UserTable />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load users/i))
  })
})
