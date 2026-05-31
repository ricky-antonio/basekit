import { describe, it, expect } from "vitest"
import { statusForCode } from "@/lib/http"
import type { ApiErrorCode } from "@/lib/types"

describe("statusForCode", () => {
  const cases: Array<[ApiErrorCode, number]> = [
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["LIMIT_EXCEEDED", 403],
    ["NOT_FOUND", 404],
    ["VALIDATION_ERROR", 400],
    ["RATE_LIMITED", 429],
    ["STRIPE_ERROR", 500],
    ["INTERNAL_ERROR", 500],
  ]

  it.each(cases)("maps %s to %i", (code, status) => {
    expect(statusForCode(code)).toBe(status)
  })
})
