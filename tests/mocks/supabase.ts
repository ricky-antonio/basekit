import { vi } from "vitest"

// Represents the return shape of a single chainable query
interface MockQueryResult<T> {
  data: T | null
  error: { message: string } | null
}

// Per-table response registry — tests call mockSupabaseFrom to configure
const tableResponses: Map<string, MockQueryResult<unknown>> = new Map()
const rpcResponses: Map<string, MockQueryResult<unknown>> = new Map()

export function mockSupabaseFrom<T>(table: string, result: MockQueryResult<T>) {
  tableResponses.set(table, result as MockQueryResult<unknown>)
}

export function mockSupabaseRpc<T>(fnName: string, result: MockQueryResult<T>) {
  rpcResponses.set(fnName, result as MockQueryResult<unknown>)
}

export function resetSupabaseMock() {
  tableResponses.clear()
  rpcResponses.clear()
}

// Chainable query builder that resolves to the configured response
function makeQueryBuilder(table: string) {
  const result = tableResponses.get(table) ?? { data: null, error: null }

  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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
}

export function mockSupabaseAuth(user: Record<string, unknown> | null) {
  mockAuthData.user = user
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
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    admin: {
      deleteUser: vi.fn(),
      listUsers: vi.fn(),
    },
  },

  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "test/avatar.png" }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/storage/v1/object/public/avatars/test/avatar.png" } }),
    })),
  },
}
