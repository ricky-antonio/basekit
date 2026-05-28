import { vi } from "vitest"

export interface CapturedEmail {
  to: string | string[]
  subject: string
  from?: string
  react?: unknown
  html?: string
  text?: string
}

const sentEmails: CapturedEmail[] = []

export const mockResendSend = vi.fn(async (email: CapturedEmail) => {
  sentEmails.push(email)
  return { data: { id: `mock-email-${Date.now()}` }, error: null }
})

export const mockResend = {
  emails: {
    send: mockResendSend,
  },
}

export function getSentEmails(): CapturedEmail[] {
  return [...sentEmails]
}

export function resetResendMock() {
  sentEmails.length = 0
  mockResendSend.mockClear()
}
