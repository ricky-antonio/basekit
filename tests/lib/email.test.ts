import { describe, it, expect } from "vitest"
import { sendTrialEndingEmail, sendPaymentFailedEmail } from "@/lib/email"

// These are Phase 2 stubs (real sends arrive in Phase 3.1). The contract under
// test here is only that they resolve without throwing — the webhook handlers
// depend on that so a missing email never breaks event processing.
describe("email send stubs", () => {
  it("sendTrialEndingEmail resolves without throwing", async () => {
    await expect(
      sendTrialEndingEmail({ workspaceId: "ws-1", trialEnd: "2026-06-01T00:00:00Z" }),
    ).resolves.toBeUndefined()
  })

  it("sendPaymentFailedEmail resolves without throwing", async () => {
    await expect(
      sendPaymentFailedEmail({ workspaceId: "ws-1" }),
    ).resolves.toBeUndefined()
  })
})
