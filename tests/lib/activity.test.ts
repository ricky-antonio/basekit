import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

const { logActivity } = await import("@/lib/activity")
const Sentry = await import("@sentry/nextjs")

// Capture inserts directly on the mock's `from` result
function captureInsert() {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const builder = {
    insert: insertMock,
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
  }
  mockSupabase.from.mockReturnValue(builder)
  return insertMock
}

function captureInsertWithError() {
  const insertMock = vi.fn().mockResolvedValue({
    data: null,
    error: { message: "connection refused" },
  })
  const builder = {
    insert: insertMock,
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
  }
  mockSupabase.from.mockReturnValue(builder)
  return insertMock
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("logActivity", () => {
  it("inserts with required fields", async () => {
    const insertMock = captureInsert()

    await logActivity({
      workspaceId: "ws-001",
      actorId: "user-001",
      action: "workspace.created",
    })

    expect(mockSupabase.from).toHaveBeenCalledWith("activity_log")
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws-001",
        actor_id: "user-001",
        action: "workspace.created",
      }),
    )
  })

  it("preserves metadata as JSON", async () => {
    const insertMock = captureInsert()
    const metadata = { plan: "pro", previousPlan: "free" }

    await logActivity({
      workspaceId: "ws-001",
      actorId: "user-001",
      action: "subscription.upgraded",
      metadata,
    })

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata }),
    )
  })

  it("does not throw if DB write fails (logs + Sentry only)", async () => {
    captureInsertWithError()

    await expect(
      logActivity({ workspaceId: "ws-001", actorId: "user-001", action: "project.created" }),
    ).resolves.toBeUndefined()

    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
