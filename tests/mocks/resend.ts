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

interface ResendSendResult {
  data: { id: string } | null
  error: { message: string; name: string } | null
}

export const mockResendSend = vi.fn(
  async (email: CapturedEmail): Promise<ResendSendResult> => {
    sentEmails.push(email)
    return { data: { id: `mock-email-${Date.now()}` }, error: null }
  },
)

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
