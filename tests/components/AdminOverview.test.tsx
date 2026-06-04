import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import AdminOverview from "@/components/admin/AdminOverview"

// Stub the chart so the overview test doesn't depend on recharts/dynamic-import timing.
vi.mock("@/components/admin/RevenueChart", () => ({
  default: () => <div data-testid="revenue-chart-stub" />,
}))

const metrics = {
  mrr: 52,
  arr: 624,
  totalUsers: 5,
  activeSubscribers: 2,
  planCounts: { free: 3, pro: 1, enterprise: 1 },
  churnRate30d: 0.1,
  trialConversionRate: 0.5,
  mrrTrend12m: [{ month: "2026-06", mrr: 52 }],
}

const activity = {
  activities: [
    { id: "a1", workspaceId: "ws-1", actorId: "u1", impersonatorId: null, action: "project.created", targetType: "project", targetId: "p1", metadata: {}, createdAt: "2026-06-01T00:00:00Z" },
  ],
  page: 1,
  pageSize: 20,
}

function mockFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  global.fetch = vi.fn((input: string) => {
    const { ok, body } = handler(String(input))
    return Promise.resolve({ ok, json: async () => body })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AdminOverview", () => {
  it("shows a skeleton, then renders metrics, breakdown, and activity", async () => {
    mockFetch((url) => (url.includes("/metrics") ? { ok: true, body: metrics } : { ok: true, body: activity }))

    render(<AdminOverview />)
    expect(screen.getByTestId("overview-skeleton")).toBeInTheDocument()

    expect(await screen.findByText("MRR")).toBeInTheDocument()
    expect(screen.getByText("$52")).toBeInTheDocument()
    expect(screen.getByText("Plan breakdown")).toBeInTheDocument()
    expect(screen.getByText("Project created")).toBeInTheDocument()
    // The chart is dynamically imported (ssr:false), so it mounts a tick later.
    expect(await screen.findByTestId("revenue-chart-stub")).toBeInTheDocument()
  })

  it("shows an error message when a fetch fails", async () => {
    mockFetch((url) => (url.includes("/metrics") ? { ok: false, body: {} } : { ok: true, body: activity }))

    render(<AdminOverview />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load metrics/i))
  })
})
