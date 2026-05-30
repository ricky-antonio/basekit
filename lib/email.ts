import { createElement, type ReactElement } from "react"
import * as Sentry from "@sentry/nextjs"
import { resend } from "@/lib/resend"
import type { ApiResult } from "@/lib/types"
import WelcomeEmail from "@/components/email/WelcomeEmail"
import VerifyEmailEmail from "@/components/email/VerifyEmailEmail"
import PasswordResetEmail from "@/components/email/PasswordResetEmail"
import PaymentFailedEmail from "@/components/email/PaymentFailedEmail"
import TrialEndingEmail from "@/components/email/TrialEndingEmail"
import TeamInvitationEmail from "@/components/email/TeamInvitationEmail"

const FROM_EMAIL = process.env["FROM_EMAIL"] ?? "basekit <onboarding@resend.dev>"
const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000"

export type SendEmailResult = ApiResult<{ id: string | null }>

export interface SendEmailParams {
  to: string
  subject: string
  react: ReactElement
}

// The single Resend entry point. Email is never on the critical path of a user
// action, so this NEVER throws: a Resend outage logs to Sentry and returns
// ok=false, and the caller carries on.
export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      react,
    })

    if (error) {
      console.error("[email.send] resend returned an error", error)
      Sentry.captureException(error, { extra: { to, subject } })
      return { ok: false, error: { error: "Could not send email.", code: "INTERNAL_ERROR" } }
    }

    return { ok: true, data: { id: data?.id ?? null } }
  } catch (error) {
    console.error("[email.send] threw", error)
    Sentry.captureException(error, { extra: { to, subject } })
    return { ok: false, error: { error: "Could not send email.", code: "INTERNAL_ERROR" } }
  }
}

export interface SendWelcomeEmailParams {
  to: string
  name?: string | null
  dashboardUrl?: string
}

export function sendWelcomeEmail({ to, name, dashboardUrl }: SendWelcomeEmailParams) {
  return sendEmail({
    to,
    subject: "Welcome to basekit",
    react: createElement(WelcomeEmail, { name, dashboardUrl: dashboardUrl ?? `${SITE_URL}/dashboard` }),
  })
}

export interface SendVerifyEmailParams {
  to: string
  verifyUrl: string
  name?: string | null
}

export function sendVerifyEmail({ to, verifyUrl, name }: SendVerifyEmailParams) {
  return sendEmail({
    to,
    subject: "Verify your email for basekit",
    react: createElement(VerifyEmailEmail, { verifyUrl, name }),
  })
}

export interface SendPasswordResetEmailParams {
  to: string
  resetUrl: string
  name?: string | null
}

export function sendPasswordResetEmail({ to, resetUrl, name }: SendPasswordResetEmailParams) {
  return sendEmail({
    to,
    subject: "Reset your basekit password",
    react: createElement(PasswordResetEmail, { resetUrl, name }),
  })
}

export interface SendPaymentFailedEmailParams {
  to: string
  workspaceName: string
  portalUrl?: string
  amountDue?: string | null
}

export function sendPaymentFailedEmail({
  to,
  workspaceName,
  portalUrl,
  amountDue,
}: SendPaymentFailedEmailParams) {
  return sendEmail({
    to,
    subject: "Your basekit payment failed — action needed",
    react: createElement(PaymentFailedEmail, {
      workspaceName,
      portalUrl: portalUrl ?? `${SITE_URL}/settings/billing`,
      amountDue,
    }),
  })
}

export interface SendTrialEndingEmailParams {
  to: string
  workspaceName: string
  portalUrl?: string
  trialEndDate?: string | null
}

export function sendTrialEndingEmail({
  to,
  workspaceName,
  portalUrl,
  trialEndDate,
}: SendTrialEndingEmailParams) {
  return sendEmail({
    to,
    subject: "Your basekit Pro trial ends in 3 days",
    react: createElement(TrialEndingEmail, {
      workspaceName,
      portalUrl: portalUrl ?? `${SITE_URL}/settings/billing`,
      trialEndDate,
    }),
  })
}

export interface SendTeamInvitationEmailParams {
  to: string
  inviterName: string
  workspaceName: string
  acceptUrl: string
  message?: string | null
}

export function sendTeamInvitationEmail({
  to,
  inviterName,
  workspaceName,
  acceptUrl,
  message,
}: SendTeamInvitationEmailParams) {
  return sendEmail({
    to,
    subject: `${inviterName} invited you to ${workspaceName} on basekit`,
    react: createElement(TeamInvitationEmail, { inviterName, workspaceName, acceptUrl, message }),
  })
}
