import { describe, it, expect } from "vitest"
import { updateProfileSchema } from "@/lib/validation/profile"

describe("updateProfileSchema", () => {
  it("accepts a valid display name", () => {
    const result = updateProfileSchema.safeParse({ displayName: "Ada Lovelace" })
    expect(result.success).toBe(true)
  })

  it("trims whitespace from display name", () => {
    const result = updateProfileSchema.safeParse({ displayName: "  Ada  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.displayName).toBe("Ada")
    }
  })

  it("rejects an empty display name", () => {
    const result = updateProfileSchema.safeParse({ displayName: "" })
    expect(result.success).toBe(false)
  })

  it("rejects a display name over 64 characters", () => {
    const result = updateProfileSchema.safeParse({ displayName: "a".repeat(65) })
    expect(result.success).toBe(false)
  })

  it("accepts an optional avatar URL", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "Ada",
      avatarUrl: "https://example.com/avatar.png",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a malformed avatar URL", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "Ada",
      avatarUrl: "not-a-url",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a null avatar URL", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "Ada",
      avatarUrl: null,
    })
    expect(result.success).toBe(true)
  })
})
