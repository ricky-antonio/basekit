import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ActivityLog from "@/components/admin/ActivityLog"
import type { AdminActivityList, AdminActivityRow } from "@/lib/admin-activity"

const mocks = vi.hoisted(() => ({ push: vi.fn(), params: "" }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.params),
}))

function row(overrides: Partial<AdminActivityRow> = {}): AdminActivityRow {
  return {
    id: "a1",
    workspaceId: "ws-1",
    actorId: "u1",
    impersonatorId: null,
    action: "admin.plan_override",
    targetType: "subscription",
    targetId: "ws-1",
    metadata: { from: "free", to: "pro", reason: "comped" },
    createdAt: "2026-06-01T00:00:00Z",
    ...overrides,
  }
}

function mockFetch(list: AdminActivityList) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => list }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.params = ""
})

describe("ActivityLog", () => {
  it("shows a skeleton, then renders the activity rows", async () => {
    mockFetch({ activities: [row()], page: 1, pageSize: 20 })
    render(<ActivityLog />)
    expect(screen.getByTestId("activity-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("Plan override")).toBeInTheDocument()
    expect(screen.getByText("Activity log")).toBeInTheDocument()
  })

  it("updates the URL when the action filter changes", async () => {
    mockFetch({ activities: [row()], page: 1, pageSize: 20 })
    render(<ActivityLog />)
    await screen.findByText("Plan override")

    await userEvent.selectOptions(screen.getByLabelText("Filter by action"), "admin.plan_override")
    expect(mocks.push).toHaveBeenCalledWith("/admin/activity?action=admin.plan_override")
  })

  it("disables Next when the page is not full", async () => {
    mockFetch({ activities: [row()], page: 1, pageSize: 20 })
    render(<ActivityLog />)
    await screen.findByText("Plan override")
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
  })

  it("shows an error message when the fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch
    render(<ActivityLog />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load the activity log/i))
  })
})
