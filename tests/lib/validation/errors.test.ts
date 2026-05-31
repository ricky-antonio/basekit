import { describe, it, expect } from "vitest"
import { zodFieldErrors } from "@/lib/validation/errors"

describe("zodFieldErrors", () => {
  it("takes the first issue per field", () => {
    const out = zodFieldErrors({ fieldErrors: { email: ["Required", "Too short"], role: ["Invalid"] } })
    expect(out).toEqual({ email: "Required", role: "Invalid" })
  })

  it("falls back to 'Invalid' when a field has no issues", () => {
    const out = zodFieldErrors({ fieldErrors: { email: undefined } })
    expect(out).toEqual({ email: "Invalid" })
  })
})
