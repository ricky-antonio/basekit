import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

// TEMPORARY: deliberate Sentry probe for the production deploy verification (5.3).
// Hit GET /api/sentry-check once on prod, confirm the error appears in Sentry Issues,
// then this route is removed. Do not keep in the codebase.
export async function GET(): Promise<Response> {
  const error = new Error(`basekit prod Sentry probe — ${new Date().toISOString()}`)
  Sentry.captureException(error)
  // Serverless functions can terminate before the event is delivered — flush first.
  await Sentry.flush(2000)
  return NextResponse.json({ ok: true, captured: error.message })
}
