# Testing rules

Tests are part of the definition of done. Not a follow-up task. Not "if there's time." Done.

---

## Philosophy

Three layers, in this order:

1. **Unit (lib/)** — pure functions or functions with mocked dependencies. Plan limits, usage logic, billing helpers, webhook event handlers, plan-name derivation. These tests are fast, deterministic, and live forever.
2. **Component (components/)** — what the user sees, using React Testing Library. Render the component with realistic props, assert on text/role/aria — not on internal state. Renaming `useState` variables must not break the test.
3. **Integration (api/)** — the full route handler with mocked external services. Sends a real `Request`, gets a real `Response`. Asserts on status + body shape.

There are no E2E tests in v1. The manual verification checklist in each phase file is the substitute. (Adding Playwright is a v2 decision.)

---

## Non-negotiable rules

1. **Write tests for a module before moving to the next.** Same session. Not a "test sprint later." Authoring order is enforced: `types → lib function → lib test → component → component test`.
2. **Never mock the module under test.** Only mock its direct dependencies. If `usage.ts` calls Supabase, mock Supabase — never mock `canCreateProject` while testing `canCreateProject`.
3. **Test behavior, not implementation.** Renaming a function, refactoring an internal helper, switching `useState` to `useReducer` — none of these should break a test. Assert on what the user sees or what the function returns, never on internal call counts (except where the call IS the behavior, e.g. "we called Stripe with these arguments").
4. **A failing test is never fixed by deleting it.** If a test fails after a code change, either the code is wrong or the test is wrong — figure out which and fix it. Deleting is forbidden without an explanatory PROGRESS.md entry.
5. **Use fake timers for anything time-dependent.** `vi.useFakeTimers()` before, `vi.useRealTimers()` after. Never real `setTimeout` in tests.
6. **Run the test suite after writing each test file.** Fix all failures before creating the next file. A red test left red for "later" stops being noticed.
7. **Never create inline mocks for Supabase, Stripe, or Resend.** Always import from `tests/mocks/supabase.ts`, `tests/mocks/stripe.ts`, `tests/mocks/resend.ts`. One canonical mock per service — drift between inline mocks is how bugs hide.
8. **Tests are part of the definition of done.** A phase is not complete until its test plan is fully implemented and passing at the coverage threshold for that phase.

---

## Authoring order (enforced)

Every feature follows this sequence:

```
1. Add/update the type in lib/types.ts
2. Add/update the Zod schema in lib/validation/
3. Write the lib function (lib/<domain>.ts)
4. Write the lib test (tests/lib/<domain>.test.ts) — and run it
5. Write the component that consumes the lib function
6. Write the component test (tests/components/<name>.test.tsx) — and run it
7. If a new API route or Server Action: write the integration test (tests/api/<name>.test.ts) — and run it
```

If you find yourself wanting to write a component before its lib function exists, you are writing in the wrong order. Stop.

---

## Per-category requirements

### AI / LLM routes
There are no AI routes in v1. Listed here so the rule is on the books for v2:
- Always mock the API call — never hit the real provider in tests.
- Cover 400 (validation), 200 (happy path), 500 (provider down), 429 (rate limited).

### Auth functions (`lib/auth.ts`)
For every helper:
- **Happy path:** user is authenticated → returns user object
- **Failure path:** no session → `ok: false, code: "UNAUTHENTICATED"`
- For `requireAdmin`: also the "authenticated but not admin" path → `ok: false, code: "FORBIDDEN"`

### Stripe webhook handlers
For each event type in `handleStripeEvent`:
- One test verifying the DB write is what we expect (correct table, correct columns, correct values)
- One test verifying duplicate `event.id` is short-circuited (idempotency)
- One test verifying missing/invalid `metadata.workspaceId` is handled gracefully (logs + Sentry, returns 200)
- One test verifying invalid signature returns 400

### Usage enforcement
- `canCreateProject` returns `true` when under limit
- `canCreateProject` returns `false` at limit
- `canCreateProject` returns `true` on the pro plan regardless of count
- `canCreateProject` returns `true` (fail open) when the DB query throws — verify Sentry was called
- Same matrix for `canAddMember`
- `incrementUsage` calls the correct RPC with the correct arguments
- `decrementUsage` does the same and never goes below 0 (relies on RPC, but the test asserts the call)

### Optimistic UI components
- Render with a server-provided list
- Trigger the mutation, assert the optimistic item appears immediately
- Simulate the server action returning `{ ok: false }` — assert the list reverts and a toast appears
- Simulate success — assert the optimistic item is replaced with the server-rendered version (this is automatic, but the test verifies no double-render)

### Email templates
- Each template renders without crashing given valid props
- Required props produce the expected text (subject preview, button URL)
- Missing optional props don't break the render

---

## Vitest config (`vitest.config.ts`)

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "**/index.ts",                  // barrel files
        "lib/supabase/middleware.ts",   // exercised by Next, not directly testable
        "components/ui/**",             // shadcn primitives
      ],
      thresholds: {
        // Phase 1 starting values; raised each phase per .claude/phases/<N>.md
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
```

---

## Setup file (`tests/setup.ts`)

```ts
import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Stub matchMedia for next-themes
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

// Stub IntersectionObserver
beforeAll(() => {
  // @ts-expect-error -- minimal stub
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// Reset DOM between tests
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Predictable env in tests
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
process.env.STRIPE_SECRET_KEY = "sk_test_dummy"
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_dummy"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_dummy"
process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test"
process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_annual_test"
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = "price_enterprise_monthly_test"
process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL = "price_enterprise_annual_test"
process.env.RESEND_API_KEY = "re_test_dummy"
process.env.FROM_EMAIL = "test@basekit.local"
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io"
process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
```

---

## Shared mocks

### `tests/mocks/supabase.ts`
A single mock factory for the Supabase client. Returns an object with `from()`, `auth`, `rpc`, etc. — each chainable to a `.single()` / `.select()` / etc. that resolves to a configurable value. Tests call `mockSupabaseFrom("subscriptions", { data: [...], error: null })` to set the next response.

Imported as:
```ts
import { mockSupabase, mockSupabaseFrom, resetSupabaseMock } from "@/tests/mocks/supabase"
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockSupabase }))
```

### `tests/mocks/stripe.ts`
Wraps the `stripe` constructor. Exposes `mockStripeSessionsCreate`, `mockStripeWebhookConstructEvent`, etc.

### `tests/mocks/resend.ts`
Wraps `Resend`. Exposes `mockResendSend` which captures every send call so tests can assert on `to`, `subject`, `react` props.

**Phase 1 builds these three mock files first** (in the same session as `lib/supabase/server.ts`). After that, every new test reuses them.

---

## Coverage thresholds per phase

| Phase | Lines | Functions | Branches | Statements |
|-------|-------|-----------|----------|------------|
| 1 — Foundation + Auth + Workspaces | 70 | 70 | 65 | 70 |
| 2 — Billing + Webhooks + Usage | 75 | 75 | 70 | 75 |
| 3 — Team + Invitations + Email | 78 | 78 | 73 | 78 |
| 4 — Admin + Impersonation | 82 | 82 | 77 | 82 |
| 5 — Landing + Polish + Pre-deploy | 85 | 85 | 80 | 85 |

Raise the thresholds in `vitest.config.ts` at the start of each phase. A phase is not complete until its threshold is met at the END of the phase, not just on average.

---

## npm scripts

In `package.json`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "email": "email dev --dir components/email --port 3001"
  }
}
```

---

## End-of-session checklist

Run all four. All must pass before committing or ending the session:

```bash
npm run type-check
npm test
npm run test:coverage   # must meet current phase threshold
npm run build
```

If any fails, fix it. Do not commit "I'll fix the test tomorrow." Tomorrow-you will find a different fire.

After all four pass, update `PROGRESS.md`: move finished items to Completed (with date), set the next item In progress.
