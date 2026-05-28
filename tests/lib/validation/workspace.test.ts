import { describe, it, expect } from "vitest"
import { updateWorkspaceSchema } from "@/lib/validation/workspace"

describe("updateWorkspaceSchema", () => {
  it("accepts a valid name and slug", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme Corp",
      slug: "acme-corp",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an empty name", () => {
    const result = updateWorkspaceSchema.safeParse({ name: "", slug: "acme" })
    expect(result.success).toBe(false)
  })

  it("rejects a name over 64 characters", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "a".repeat(65),
      slug: "acme",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a slug over 48 characters", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme",
      slug: "a".repeat(49),
    })
    expect(result.success).toBe(false)
  })

  it("rejects a slug with uppercase letters", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme",
      slug: "Acme-Corp",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a slug with spaces", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme",
      slug: "acme corp",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a slug with special characters", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme",
      slug: "acme_corp!",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a slug with numbers and hyphens", () => {
    const result = updateWorkspaceSchema.safeParse({
      name: "Acme",
      slug: "acme-corp-2",
    })
    expect(result.success).toBe(true)
  })
})
