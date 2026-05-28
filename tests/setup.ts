import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, vi } from "vitest"
import { cleanup } from "@testing-library/react"

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

beforeAll(() => {
  // @ts-expect-error -- minimal stub
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test.supabase.co"
process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "test-anon-key"
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
process.env["STRIPE_SECRET_KEY"] = "sk_test_dummy"
process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] = "pk_test_dummy"
process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_dummy"
process.env["STRIPE_PRICE_PRO_MONTHLY"] = "price_pro_monthly_test"
process.env["STRIPE_PRICE_PRO_ANNUAL"] = "price_pro_annual_test"
process.env["STRIPE_PRICE_ENTERPRISE_MONTHLY"] = "price_enterprise_monthly_test"
process.env["STRIPE_PRICE_ENTERPRISE_ANNUAL"] = "price_enterprise_annual_test"
process.env["RESEND_API_KEY"] = "re_test_dummy"
process.env["FROM_EMAIL"] = "test@basekit.local"
process.env["UPSTASH_REDIS_REST_URL"] = "https://test.upstash.io"
process.env["UPSTASH_REDIS_REST_TOKEN"] = "test-token"
process.env["NEXT_PUBLIC_SITE_URL"] = "http://localhost:3000"
