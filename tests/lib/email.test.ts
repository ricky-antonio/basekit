import { describe, it, expect, beforeEach, vi } from "vitest"
import { createElement, type ReactElement } from "react"
import {
  mockResend,
  mockResendSend,
  getSentEmails,
  resetResendMock,
} from "@/tests/mocks/resend"

vi.mock("@/lib/resend", () => ({ resend: mockResend }))
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import {
  sendEmail,
  sendWelcomeEmail,
  sendVerifyEmail,
  sendPasswordResetEmail,
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendTeamInvitationEmail,
} from "@/lib/email"
import * as Sentry from "@sentry/nextjs"
import WelcomeEmail from "@/components/email/WelcomeEmail"
import TeamInvitationEmail from "@/components/email/TeamInvitationEmail"

function lastReact<P>(): ReactElement<P> {
  const emails = getSentEmails()
  return emails[emails.length - 1]?.react as ReactElement<P>
}

beforeEach(() => {
  resetResendMock()
  vi.clearAllMocks()
})

describe("sendEmail", () => {
  it("calls Resend with the provided args", async () => {
    await sendEmail({ to: "a@b.com", subject: "Hi", react: createElement("div") })

    expect(mockResendSend).toHaveBeenCalledTimes(1)
    const sent = getSentEmails()[0]
    expect(sent?.to).toBe("a@b.com")
    expect(sent?.subject).toBe("Hi")
    expect(sent?.from).toBeTruthy()
  })

  it("returns ok=false on a Resend error (does not throw)", async () => {
    mockResendSend.mockResolvedValueOnce({ data: null, error: { message: "boom", name: "x" } })

    const result = await sendEmail({ to: "a@b.com", subject: "Hi", react: createElement("div") })

    expect(result.ok).toBe(false)
  })

  it("logs to Sentry on failure", async () => {
    mockResendSend.mockResolvedValueOnce({ data: null, error: { message: "boom", name: "x" } })

    await sendEmail({ to: "a@b.com", subject: "Hi", react: createElement("div") })

    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it("returns ok=false and logs to Sentry when Resend throws", async () => {
    mockResendSend.mockRejectedValueOnce(new Error("network down"))

    const result = await sendEmail({ to: "a@b.com", subject: "Hi", react: createElement("div") })

    expect(result.ok).toBe(false)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})

describe("typed send functions", () => {
  it("sendWelcomeEmail composes the right subject and react template", async () => {
    await sendWelcomeEmail({ to: "a@b.com", name: "Ada" })

    const sent = getSentEmails()[0]
    expect(sent?.subject).toBe("Welcome to basekit")
    expect(lastReact().type).toBe(WelcomeEmail)
  })

  it("sendVerifyEmail passes the verify URL into template props", async () => {
    await sendVerifyEmail({ to: "a@b.com", verifyUrl: "https://basekit.test/verify/abc" })

    expect(lastReact<{ verifyUrl: string }>().props.verifyUrl).toBe(
      "https://basekit.test/verify/abc",
    )
  })

  it("sendPasswordResetEmail includes the reset URL", async () => {
    await sendPasswordResetEmail({ to: "a@b.com", resetUrl: "https://basekit.test/reset/xyz" })

    expect(lastReact<{ resetUrl: string }>().props.resetUrl).toBe("https://basekit.test/reset/xyz")
  })

  it("sendPaymentFailedEmail includes the portal URL", async () => {
    await sendPaymentFailedEmail({
      to: "a@b.com",
      workspaceName: "Acme",
      portalUrl: "https://basekit.test/settings/billing",
    })

    expect(lastReact<{ portalUrl: string }>().props.portalUrl).toBe(
      "https://basekit.test/settings/billing",
    )
  })

  it("sendPaymentFailedEmail defaults the portal URL to the billing page", async () => {
    await sendPaymentFailedEmail({ to: "a@b.com", workspaceName: "Acme" })

    expect(lastReact<{ portalUrl: string }>().props.portalUrl).toContain("/settings/billing")
  })

  it("sendTrialEndingEmail includes the 3-day reminder text in the subject", async () => {
    await sendTrialEndingEmail({ to: "a@b.com", workspaceName: "Acme" })

    expect(getSentEmails()[0]?.subject).toContain("3 days")
  })

  it("sendTeamInvitationEmail includes the accept URL in template props", async () => {
    await sendTeamInvitationEmail({
      to: "a@b.com",
      inviterName: "Ada",
      workspaceName: "Acme",
      acceptUrl: "https://basekit.test/team/accept/tok",
    })

    const sent = getSentEmails()[0]
    expect(sent?.subject).toBe("Ada invited you to Acme on basekit")
    expect(lastReact<{ acceptUrl: string }>().type).toBe(TeamInvitationEmail)
    expect(lastReact<{ acceptUrl: string }>().props.acceptUrl).toBe(
      "https://basekit.test/team/accept/tok",
    )
  })
})
