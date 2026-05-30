import { Resend } from "resend"

// Vendor client singleton — mirrors lib/stripe/client.ts. Excluded from coverage
// (a constructor with no logic) and mocked in tests via vi.mock("@/lib/resend").
export const resend = new Resend(process.env["RESEND_API_KEY"]!)
