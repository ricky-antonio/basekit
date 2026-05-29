// Transactional email send functions.
//
// Phase 2 needs the call sites (the Stripe webhook routes trial-ending and
// payment-failed events here) but the real Resend + React Email implementation
// lands in Phase 3.1. These are intentional stubs: they resolve without sending
// so the webhook flow is complete and testable now, and 3.1 fills in the bodies.

export interface TrialEndingEmailParams {
  workspaceId: string
  trialEnd: string | null
}

export async function sendTrialEndingEmail(params: TrialEndingEmailParams): Promise<void> {
  console.info(`[email] (stub) trial-ending notification queued for workspace ${params.workspaceId}`)
}

export interface PaymentFailedEmailParams {
  workspaceId: string
}

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams): Promise<void> {
  console.info(`[email] (stub) payment-failed notification queued for workspace ${params.workspaceId}`)
}
