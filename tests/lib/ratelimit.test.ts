import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the Upstash packages before importing ratelimit
const mockLimit = vi.fn()

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({})),
  },
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    constructor() {}
    limit = mockLimit
    static slidingWindow = vi.fn().mockReturnValue({})
  },
}))

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

const { checkRateLimit } = await import("@/lib/ratelimit")
const Sentry = await import("@sentry/nextjs")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkRateLimit", () => {
  it("returns success when under limit", async () => {
    const futureReset = Date.now() + 60_000
    mockLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: futureReset })

    const result = await checkRateLimit("login", "test-user")
    expect(result.success).toBe(true)
  })

  it("returns RATE_LIMITED error when over limit", async () => {
    const futureReset = Date.now() + 60_000
    mockLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: futureReset })

    const result = await checkRateLimit("login", "test-user")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED")
    }
  })

  it("checkRateLimit error message includes reset time", async () => {
    const futureReset = new Date("2030-01-01T12:00:00Z").getTime()
    mockLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: futureReset })

    const result = await checkRateLimit("signup", "test-ip")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.error).toContain("Try again at")
    }
  })

  it("fails open (allows the request) and reports to Sentry when Redis throws", async () => {
    mockLimit.mockRejectedValue(new Error("redis unreachable"))

    const result = await checkRateLimit("webhookStripe", "1.2.3.4")
    expect(result.success).toBe(true)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
