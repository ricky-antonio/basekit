import type { ApiErrorCode } from "@/lib/types"

// Maps a domain error code to the HTTP status an API route should return. Kept in
// one place so every route is consistent. LIMIT_EXCEEDED is 403 (a permission-style
// refusal the caller can resolve by upgrading), per the Phase 3 spec.
export function statusForCode(code: ApiErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401
    case "FORBIDDEN":
    case "LIMIT_EXCEEDED":
      return 403
    case "NOT_FOUND":
      return 404
    case "VALIDATION_ERROR":
      return 400
    case "RATE_LIMITED":
      return 429
    case "STRIPE_ERROR":
    case "INTERNAL_ERROR":
      return 500
  }
}
