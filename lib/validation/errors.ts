// Flattens a Zod error's per-field issues into the single-string-per-field shape
// our ApiError.fieldErrors uses. Takes the first issue per field — the UI shows one
// message at a time. Shared so every route/action produces the same error shape.
export function zodFieldErrors(flatten: {
  fieldErrors: Record<string, string[] | undefined>
}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, issues] of Object.entries(flatten.fieldErrors)) {
    out[key] = issues?.[0] ?? "Invalid"
  }
  return out
}
