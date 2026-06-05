import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import toast from "react-hot-toast"
import UserDetail from "@/components/admin/UserDetail"
import type { AdminUserDetail } from "@/lib/admin"

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const detail: AdminUserDetail = {
  userId: "u1",
  email: "alice@example.com",
  displayName: "Alice Admin",
  avatarUrl: null,
  role: "user",
  workspace: { id: "ws-1", name: "Acme", slug: "acme", createdAt: "2026-01-01T00:00:00Z" },
  subscription: {
    planName: "free",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-07-01T00:00:00Z",
    stripeCustomerId: "cus_1",
  },
  recentActivity: [
    { id: "a1", workspaceId: "ws-1", actorId: "u1", impersonatorId: null, action: "project.created", targetType: "project", targetId: "p1", metadata: {}, createdAt: "2026-06-01T00:00:00Z" },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("UserDetail", () => {
  it("shows a skeleton, then renders the user, subscription, and activity", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => detail }) as unknown as typeof fetch

    render(<UserDetail userId="u1" />)
    expect(screen.getByTestId("user-detail-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument()
    expect(screen.getByText("Acme")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "cus_1" })).toHaveAttribute("href", "https://dashboard.stripe.com/customers/cus_1")
    expect(screen.getByText("Project created")).toBeInTheDocument()
  })

  it("overrides the plan via the dialog and shows a success toast", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => detail })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<UserDetail userId="u1" />)
    await screen.findByText("Alice Admin")

    await userEvent.click(screen.getByRole("button", { name: "Override plan" }))
    await userEvent.selectOptions(screen.getByLabelText("New plan"), "pro")
    await userEvent.type(screen.getByLabelText("Reason"), "comped")
    await userEvent.click(screen.getByRole("button", { name: "Confirm override" }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/u1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    )
    const patchCall = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PATCH")
    expect(JSON.parse((patchCall?.[1] as RequestInit).body as string)).toEqual({ plan: "pro", reason: "comped" })
    expect(toast.success).toHaveBeenCalledWith("Plan set to pro.")
  })

  it("toasts an error when the override is rejected", async () => {
    global.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve({ ok: false, json: async () => ({ error: "No workspace found for this user.", code: "NOT_FOUND" }) })
      }
      return Promise.resolve({ ok: true, json: async () => detail })
    }) as unknown as typeof fetch

    render(<UserDetail userId="u1" />)
    await screen.findByText("Alice Admin")

    await userEvent.click(screen.getByRole("button", { name: "Override plan" }))
    await userEvent.selectOptions(screen.getByLabelText("New plan"), "pro")
    await userEvent.type(screen.getByLabelText("Reason"), "comped")
    await userEvent.click(screen.getByRole("button", { name: "Confirm override" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No workspace found for this user."))
  })

  it("starts impersonation via the impersonate endpoint when Impersonate is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => detail })
    global.fetch = fetchMock as unknown as typeof fetch
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "" },
    })

    render(<UserDetail userId="u1" />)
    await screen.findByText("Alice Admin")

    await userEvent.click(screen.getByRole("button", { name: "Impersonate" }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/u1/impersonate",
        expect.objectContaining({ method: "POST" }),
      ),
    )
  })

  it("shows an error message when the user fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch

    render(<UserDetail userId="u1" />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load this user/i))
  })
})
