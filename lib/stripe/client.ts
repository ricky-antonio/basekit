import Stripe from "stripe"

// apiVersion is pinned to the version the installed `stripe` types target. A
// mismatched string is a compile error (the type is the literal LatestApiVersion).
export const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
})
