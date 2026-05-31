import { vi } from "vitest"

// Represents the return shape of a single chainable query
interface MockQueryResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

// Per-table response registry — tests call mockSupabaseFrom to configure
const tableResponses: Map<string, MockQueryResult<unknown>> = new Map()
const rpcResponses: Map<string, MockQueryResult<unknown>> = new Map()

// Write capture — records every insert/update/upsert/delete so tests can assert
// on the exact columns/values written (required for webhook handler tests).
export interface CapturedWrite {
  table: string
  op: "insert" | "update" | "upsert" | "delete"
  payload: unknown
  options?: unknown
}
const writes: CapturedWrite[] = []

// Filter capture — records chainable comparison filters (eq/is/in/…) so query
// functions can assert the filter they applied (e.g. `accepted_at IS NULL`).
export interface CapturedFilter {
  table: string
  method: string
  args: unknown[]
}
const filters: CapturedFilter[] = []

export function getSupabaseFilters(table?: string): CapturedFilter[] {
  return table ? filters.filter((f) => f.table === table) : filters
}

export function getSupabaseWrites(): CapturedWrite[] {
  return writes
}

export function getLastWrite(table: string, op?: CapturedWrite["op"]): CapturedWrite | undefined {
  for (let i = writes.length - 1; i >= 0; i--) {
    const write = writes[i]
    if (write && write.table === table && (!op || write.op === op)) return write
  }
  return undefined
}

export function mockSupabaseFrom<T>(table: string, result: MockQueryResult<T>) {
  tableResponses.set(table, result as MockQueryResult<unknown>)
}

export function mockSupabaseRpc<T>(fnName: string, result: MockQueryResult<T>) {
  rpcResponses.set(fnName, result as MockQueryResult<unknown>)
}

export function resetSupabaseMock() {
  tableResponses.clear()
  rpcResponses.clear()
  writes.length = 0
  filters.length = 0
  mockAuthData.adminUser = null
}

// Chainable query builder that resolves to the configured response
function makeQueryBuilder(table: string) {
  const result = tableResponses.get(table) ?? { data: null, error: null }

  const record = (op: CapturedWrite["op"], payload: unknown, options?: unknown) => {
    writes.push({ table, op, payload, options })
    return chain
  }

  const recordFilter = (method: string, args: unknown[]) => {
    filters.push({ table, method, args })
    return chain
  }

  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn((payload: unknown) => record("insert", payload)),
    update: vi.fn((payload: unknown) => record("update", payload)),
    upsert: vi.fn((payload: unknown, options?: unknown) => record("upsert", payload, options)),
    delete: vi.fn(() => record("delete", null)),
    eq: vi.fn((...args: unknown[]) => recordFilter("eq", args)),
    neq: vi.fn((...args: unknown[]) => recordFilter("neq", args)),
    in: vi.fn((...args: unknown[]) => recordFilter("in", args)),
    is: vi.fn((...args: unknown[]) => recordFilter("is", args)),
    gt: vi.fn((...args: unknown[]) => recordFilter("gt", args)),
    gte: vi.fn((...args: unknown[]) => recordFilter("gte", args)),
    lt: vi.fn((...args: unknown[]) => recordFilter("lt", args)),
    lte: vi.fn((...args: unknown[]) => recordFilter("lte", args)),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  }

  // Make the chain itself thenable (resolves on await)
  Object.assign(chain, {
    then: (resolve: (v: MockQueryResult<unknown>) => void) => Promise.resolve(result).then(resolve),
  })

  return chain
}

const mockAuthData = {
  user: null as Record<string, unknown> | null,
  session: null as Record<string, unknown> | null,
  adminUser: null as Record<string, unknown> | null,
}

export function mockSupabaseAuth(user: Record<string, unknown> | null) {
  mockAuthData.user = user
}

// Configures the next supabase.auth.admin.getUserById(...) response (the user row).
export function mockSupabaseAdminUser(user: Record<string, unknown> | null) {
  mockAuthData.adminUser = user
}

export const mockSupabase = {
  from: vi.fn((table: string) => makeQueryBuilder(table)),

  rpc: vi.fn((fnName: string) => {
    const result = rpcResponses.get(fnName) ?? { data: null, error: null }
    return Promise.resolve(result)
  }),

  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: mockAuthData.user }, error: null }),
    ),
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: mockAuthData.session }, error: null }),
    ),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    verifyOtp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    admin: {
      deleteUser: vi.fn(),
      listUsers: vi.fn(),
      getUserById: vi.fn(() =>
        Promise.resolve({ data: { user: mockAuthData.adminUser }, error: null }),
      ),
    },
  },

  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "test/avatar.png" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/storage/v1/object/public/avatars/test/avatar.png" } }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}
