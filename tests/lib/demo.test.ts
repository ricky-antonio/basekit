import { describe, it, expect, afterEach } from "vitest"
import { isDemoEmail, DEMO_DISABLED_ERROR } from "@/lib/demo"

describe("isDemoEmail", () => {
  const original = process.env["DEMO_USER_EMAIL"]
  afterEach(() => {
    process.env["DEMO_USER_EMAIL"] = original
  })

  it("matches the @demo.basekit.test seed domain", () => {
    expect(isDemoEmail("nova-1234@demo.basekit.test")).toBe(true)
  })

  it("matches the configured demo login account", () => {
    process.env["DEMO_USER_EMAIL"] = "showcase@example.com"
    expect(isDemoEmail("showcase@example.com")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isDemoEmail("NOVA@DEMO.BASEKIT.TEST")).toBe(true)
    process.env["DEMO_USER_EMAIL"] = "Demo@Demo.basekit.test"
    expect(isDemoEmail("demo@demo.basekit.test")).toBe(true)
  })

  it("returns false for a real account", () => {
    expect(isDemoEmail("rickyantonio.codes@gmail.com")).toBe(false)
  })

  it("returns false for null/undefined/empty", () => {
    expect(isDemoEmail(null)).toBe(false)
    expect(isDemoEmail(undefined)).toBe(false)
    expect(isDemoEmail("")).toBe(false)
  })

  it("does not match the demo login when the env var is unset", () => {
    delete process.env["DEMO_USER_EMAIL"]
    expect(isDemoEmail("rickyantonio.codes@gmail.com")).toBe(false)
    // domain matching still works without the env var
    expect(isDemoEmail("x@demo.basekit.test")).toBe(true)
  })
})

describe("DEMO_DISABLED_ERROR", () => {
  it("is a FORBIDDEN ApiError with a user-facing message", () => {
    expect(DEMO_DISABLED_ERROR.code).toBe("FORBIDDEN")
    expect(DEMO_DISABLED_ERROR.error).toMatch(/demo/i)
  })
})
