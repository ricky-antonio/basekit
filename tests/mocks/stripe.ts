import { vi } from "vitest"

export const mockStripeSessionsCreate = vi.fn()
export const mockStripePortalSessionsCreate = vi.fn()
export const mockStripeSubscriptionsCancel = vi.fn()
export const mockStripeCustomersCreate = vi.fn()
export const mockStripeCustomersRetrieve = vi.fn()
export const mockStripeWebhookConstructEvent = vi.fn()

export const mockStripe = {
  checkout: {
    sessions: {
      create: mockStripeSessionsCreate,
    },
  },
  billingPortal: {
    sessions: {
      create: mockStripePortalSessionsCreate,
    },
  },
  subscriptions: {
    cancel: mockStripeSubscriptionsCancel,
    update: vi.fn(),
    retrieve: vi.fn(),
  },
  customers: {
    create: mockStripeCustomersCreate,
    retrieve: mockStripeCustomersRetrieve,
    update: vi.fn(),
  },
  webhooks: {
    constructEvent: mockStripeWebhookConstructEvent,
  },
  prices: {
    retrieve: vi.fn(),
  },
}

// Reset all Stripe mocks between tests
export function resetStripeMock() {
  mockStripeSessionsCreate.mockReset()
  mockStripePortalSessionsCreate.mockReset()
  mockStripeSubscriptionsCancel.mockReset()
  mockStripeCustomersCreate.mockReset()
  mockStripeCustomersRetrieve.mockReset()
  mockStripeWebhookConstructEvent.mockReset()
}
