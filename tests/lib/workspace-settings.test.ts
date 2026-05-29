import { describe, it, expect, vi, beforeEach } from "vitest"
import { mockSupabase, resetSupabaseMock } from "@/tests/mocks/supabase"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockSupabase,
  createServiceClient: () => mockSupabase,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

import { updateWorkspace } from "@/lib/workspace-settings"

const workspaceId = "ws-123"
const userId = "user-1"
const workspaceRow = {
  id: workspaceId,
  name: "Acme Corp",
  slug: "acme-corp",
  owner_id: userId,
  created_at: "2026-01-01T00:00:00Z",
}

type FromImpl = (table: string) => ReturnType<typeof mockSupabase.from>

// Mock helpers that return chainable query builders for each call type.
const ownerLookup = (ownerId: string | null): ReturnType<typeof mockSupabase.from> =>
  ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(
      ownerId === null
        ? { data: null, error: { message: "not found" } }
        : { data: { owner_id: ownerId }, error: null },
    ),
  } as ReturnType<typeof mockSupabase.from>)

const slugCheck = (conflict: { id: string } | null): ReturnType<typeof mockSupabase.from> =>
  ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: conflict, error: null }),
  } as ReturnType<typeof mockSupabase.from>)

const updateRow = (
  result: typeof workspaceRow | null,
  error: { message: string } | null = null,
): ReturnType<typeof mockSupabase.from> =>
  ({
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: result, error }),
  } as ReturnType<typeof mockSupabase.from>)

function sequence(...impls: ReturnType<typeof mockSupabase.from>[]) {
  let i = 0
  return ((_table: string) => {
    const impl = impls[i] ?? impls[impls.length - 1]
    i++
    return impl
  }) as FromImpl
}

beforeEach(() => {
  resetSupabaseMock()
  vi.clearAllMocks()
})

describe("updateWorkspace", () => {
  it("returns updated workspace when caller is the owner and slug is unique", async () => {
    vi.mocked(mockSupabase.from).mockImplementation(
      sequence(ownerLookup(userId), slugCheck(null), updateRow(workspaceRow)),
    )
    const result = await updateWorkspace(workspaceId, userId, "Acme Corp", "acme-corp")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.slug).toBe("acme-corp")
  })

  it("returns FORBIDDEN when caller is not the workspace owner", async () => {
    vi.mocked(mockSupabase.from).mockImplementationOnce(() => ownerLookup("different-user"))
    const result = await updateWorkspace(workspaceId, userId, "Acme Corp", "acme-corp")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN")
  })

  it("returns NOT_FOUND when the workspace does not exist", async () => {
    vi.mocked(mockSupabase.from).mockImplementationOnce(() => ownerLookup(null))
    const result = await updateWorkspace(workspaceId, userId, "Acme Corp", "acme-corp")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND")
  })

  it("returns VALIDATION_ERROR when slug is already taken", async () => {
    vi.mocked(mockSupabase.from).mockImplementation(
      sequence(ownerLookup(userId), slugCheck({ id: "other-ws" })),
    )
    const result = await updateWorkspace(workspaceId, userId, "Acme Corp", "taken-slug")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR")
      expect(result.error.fieldErrors?.slug).toBeTruthy()
    }
  })

  it("returns INTERNAL_ERROR when the update query fails", async () => {
    vi.mocked(mockSupabase.from).mockImplementation(
      sequence(ownerLookup(userId), slugCheck(null), updateRow(null, { message: "db error" })),
    )
    const result = await updateWorkspace(workspaceId, userId, "Acme Corp", "new-slug")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("INTERNAL_ERROR")
  })
})
