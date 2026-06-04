import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import SubscriptionsTable from "@/components/admin/SubscriptionsTable"
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
    displayName: "Alice",
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

describe("SubscriptionsTable", () => {
  it("renders subscription rows with a Stripe deep link", async () => {
    mockFetch({ users: [user()], total: 1, page: 1, pageSize: 20 })
    render(<SubscriptionsTable />)
    expect(screen.getByTestId("subscriptions-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("Acme")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Stripe/ })).toHaveAttribute("href", "https://dashboard.stripe.com/customers/cus_1")
  })

  it("updates the URL when the status filter changes", async () => {
    mockFetch({ users: [user()], total: 1, page: 1, pageSize: 20 })
    render(<SubscriptionsTable />)
    await screen.findByText("Acme")

    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "past_due")
    expect(mocks.push).toHaveBeenCalledWith("/admin/subscriptions?status=past_due")
  })

  it("shows 'No customer' for a subscription without a Stripe customer", async () => {
    mockFetch({ users: [user({ stripeCustomerId: null })], total: 1, page: 1, pageSize: 20 })
    render(<SubscriptionsTable />)
    expect(await screen.findByText("No customer")).toBeInTheDocument()
  })

  it("shows an error message when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch
    render(<SubscriptionsTable />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load subscriptions/i))
  })
})
