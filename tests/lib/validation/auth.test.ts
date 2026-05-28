import { describe, it, expect } from "vitest"
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth"

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "pw" }).success).toBe(true)
  })

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "pw" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["email"])
    }
  })

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["password"])
    }
  })
})

describe("signupSchema", () => {
  it("accepts valid input", () => {
    const r = signupSchema.safeParse({
      displayName: "Jane",
      email: "jane@example.com",
      password: "longenough",
    })
    expect(r.success).toBe(true)
  })

  it("trims the display name", () => {
    const r = signupSchema.safeParse({
      displayName: "  Jane  ",
      email: "jane@example.com",
      password: "longenough",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.displayName).toBe("Jane")
  })

  it("rejects passwords shorter than 8 characters", () => {
    const r = signupSchema.safeParse({
      displayName: "Jane",
      email: "jane@example.com",
      password: "short",
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["password"])
  })

  it("rejects display names longer than 64 characters", () => {
    const r = signupSchema.safeParse({
      displayName: "x".repeat(65),
      email: "jane@example.com",
      password: "longenough",
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["displayName"])
  })

  it("rejects an empty display name", () => {
    const r = signupSchema.safeParse({
      displayName: "",
      email: "jane@example.com",
      password: "longenough",
    })
    expect(r.success).toBe(false)
  })
})

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true)
  })

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false)
  })
})

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ characters", () => {
    const r = resetPasswordSchema.safeParse({ password: "longenough", confirmPassword: "longenough" })
    expect(r.success).toBe(true)
  })

  it("rejects mismatched passwords with the error on confirmPassword", () => {
    const r = resetPasswordSchema.safeParse({ password: "longenough", confirmPassword: "different1" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["confirmPassword"])
    }
  })

  it("rejects passwords shorter than 8 characters", () => {
    const r = resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" })
    expect(r.success).toBe(false)
  })
})
