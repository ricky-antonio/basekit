# Phase 2 — Billing + Webhooks + Usage

**Complete this phase entirely before starting Phase 3.**

## Goal
A user on the Free plan can hit the 3-project limit, see an upgrade prompt, click "Upgrade to Pro," complete Stripe Checkout (test mode), trigger the webhook, have their plan flip to Pro, and unlock unlimited projects. They can also open the Stripe Customer Portal and cancel — webhook brings them back to Free at period end.

## Checkpoints

This phase is split into three checkpoints. Execute one per session. End each with the closeout protocol from CLAUDE.md.

- **Checkpoint 2.1 — Stripe lib + webhook handler + usage enforcement.** *Engine room — webhook from the terminal flips the database correctly. No UI yet.*
- **Checkpoint 2.2 — Projects domain end-to-end.** *Demo resource works — free user hits 3-project limit, UpgradePrompt appears.*
- **Checkpoint 2.3 — Billing API routes + billing settings page.** *Full upgrade lifecycle works in the browser end to end.*

---

## Checkpoint 2.1 — Stripe lib + webhook handler + usage enforcement

### What gets built
- Stripe SDK client + plan-name helpers (`lib/stripe/client.ts`, `lib/billing.ts`)
- Checkout + portal session lib functions (`lib/stripe/checkout.ts`, `lib/stripe/portal.ts`)
- Webhook event handler library (`lib/stripe/webhooks.ts`) — one function per Stripe event type
- Webhook API route (`app/api/webhooks/stripe/route.ts`) — signature verify + idempotency + dispatch
- Usage enforcement library (`lib/usage.ts`) — `canCreateProject`, `canAddMember`, `incrementUsage`, `decrementUsage`
- Billing/webhook Zod schemas (`lib/validation/billing.ts`)

### In plain English
We're building the engine of the billing system before any user-facing UI. The most important piece is the webhook handler: Stripe sends events when subscriptions change, and we have to translate them into database updates correctly the first time, every time. By the end of this checkpoint, you can trigger a fake Stripe event from the command line (`stripe trigger checkout.session.completed`) and watch the corresponding `subscriptions` row appear in the database with the right plan, status, and dates. The plan-limit checks (can this user create another project? can this workspace invite another member?) are also fully wired. No buttons or pages yet — everything is testable from the terminal or via our test suite.

### Done when
- `stripe trigger checkout.session.completed` → corresponding `subscriptions` row written with correct `plan_name`, `status`, periods, customer/sub IDs
- `stripe trigger customer.subscription.deleted` → row flips to `plan_name='free'`, `status='canceled'`
- `stripe trigger invoice.payment_failed` → `status='past_due'`
- Webhook returns 400 on bad signature, 200 on valid event, 200 on duplicate event (idempotency — `stripe_events` has exactly one row per event)
- `canCreateProject`/`canAddMember` return correct values for each plan/count combo, and fail-open on DB error (with Sentry call)
- All Stripe webhook handler tests pass; all usage tests pass; all billing-lib tests pass
- `npm run test:coverage` ≥ 75%; `npm run type-check` zero errors; `npm run build` zero errors

### Tasks

**Stripe lib**
- [ ] `lib/stripe/client.ts` — `stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: latest })`
- [ ] `lib/billing.ts` — `getWorkspaceSubscription`, `getOrCreateStripeCustomer`, `getPlanNameFromPriceId`, `getActivePlan`
- [ ] `lib/stripe/checkout.ts` — `createCheckoutSession({ workspaceId, priceId, userEmail })`
- [ ] `lib/stripe/portal.ts` — `createPortalSession({ customerId, returnUrl })`
- [ ] `lib/stripe/webhooks.ts` — `handleStripeEvent(event)` with one handler per event type
- [ ] `lib/validation/billing.ts` — Zod for checkout/portal/cancel bodies + per-event webhook payloads

**Usage enforcement**
- [ ] `lib/usage.ts` — `getUsage`, `canCreateProject`, `canAddMember`, `incrementUsage`, `decrementUsage`. Helpers fail open on DB errors (Sentry-logged, return `true`).

**Webhook API route**
- [ ] `app/api/webhooks/stripe/route.ts` — verify signature → check `stripe_events` for idempotency → `handleStripeEvent` → insert `stripe_events` → return 200 (even on internal failure, with Sentry capture). Rate-limited.
- [ ] `revalidateTag("subscription:" + workspaceId)` after every successful update

### Tests to write in this checkpoint

**`tests/lib/billing.test.ts`**
- `it("getPlanNameFromPriceId returns 'pro' for pro monthly env value")`
- `it("getPlanNameFromPriceId returns 'pro' for pro annual env value")`
- `it("getPlanNameFromPriceId returns 'enterprise' for enterprise monthly")`
- `it("getPlanNameFromPriceId returns 'enterprise' for enterprise annual")`
- `it("getPlanNameFromPriceId returns 'free' for unknown ID")`
- `it("getWorkspaceSubscription returns the subscription row")`
- `it("getActivePlan returns 'free' when no subscription row")`
- `it("getOrCreateStripeCustomer returns existing customer ID if set")`
- `it("getOrCreateStripeCustomer creates Stripe customer and persists ID when missing")`

**`tests/lib/usage.test.ts`**
- `it("canCreateProject returns true when under free limit")`
- `it("canCreateProject returns false when at free limit")`
- `it("canCreateProject returns true for pro plan regardless of count")`
- `it("canCreateProject returns true for enterprise plan regardless of count")`
- `it("canCreateProject returns true (fail-open) when DB query throws")` (verify Sentry called)
- `it("canAddMember mirrors the same matrix")`
- `it("incrementUsage calls increment_usage RPC")`
- `it("decrementUsage calls decrement_usage RPC")`

**`tests/lib/stripe/webhooks.test.ts`**
- `it("checkout.session.completed upserts subscription with correct plan")`
- `it("checkout.session.completed sets trial_end when subscription_data.trial_period_days set")`
- `it("customer.subscription.updated changes plan when price changes")`
- `it("customer.subscription.updated sets cancel_at_period_end")`
- `it("customer.subscription.deleted sets plan to free and status to canceled")`
- `it("invoice.payment_failed sets status to past_due")`
- `it("invoice.payment_succeeded updates current_period_end")`
- `it("customer.subscription.trial_will_end triggers trial-ending email send (stubbed in 2.1, real in 3.1)")`
- `it("missing workspaceId metadata is logged and returns gracefully")`
- `it("unknown event type is ignored without error")`

**`tests/api/webhooks-stripe.test.ts`**
- `it("returns 400 on invalid signature")`
- `it("returns 200 on valid event")`
- `it("returns 200 on duplicate event ID without re-processing")`
- `it("inserts row in stripe_events after successful processing")`
- `it("returns 200 even when handler throws (idempotency)")` (verify Sentry call)
- `it("returns 429 when rate limit exceeded")`

### Manual verification for this checkpoint
- [ ] Use Stripe CLI: trigger each of `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_failed`, `invoice.payment_succeeded` — verify DB state changes
- [ ] Send the same webhook twice → second short-circuits (one row in `stripe_events`)
- [ ] Send a deliberately invalid signature → 400 returned, Sentry event captured
- [ ] Hit rate limit on webhook endpoint → 429 with friendly error
- [ ] Re-run RLS two-account test specifically for `subscriptions` table (User B cannot read User A's row)

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 2.1 — Stripe lib + webhook + usage enforcement`.

---

## Checkpoint 2.2 — Projects domain end-to-end

### What gets built
- Projects library (`lib/projects.ts`) — list, get, create, delete
- Projects validation Zod schemas
- `/projects` list page with usage bar at top
- `/projects/new` create form
- `/projects/[id]` detail page with delete button
- `<UpgradePrompt />` component (used here AND on billing page in 2.3)
- Loading skeletons

### In plain English
The "projects" feature is our demo of how plan limits feel to a real user. After this checkpoint, a logged-in free user can create up to 3 projects from the UI. On their 4th attempt, the server rejects with a clear `LIMIT_EXCEEDED` code and the page renders an upgrade prompt component pointing at `/settings/billing` (which doesn't exist yet — that's 2.3). They can view and delete projects, and deleting decrements the usage counter so they can create another. No actual billing flow yet — this checkpoint proves the usage-enforcement engine works in a real UI flow.

### Done when
- Free user creates 3 projects via `/projects/new`; 4th returns `LIMIT_EXCEEDED`
- `<UpgradePrompt />` renders on limit hit, links to `/settings/billing`
- Delete project → usage decrements, list updates
- `/projects` loading skeleton renders during initial fetch (no empty flash)
- All project lib + component tests pass
- `npm run test:coverage` ≥ 75%; `npm run build` zero errors

### Tasks

**Projects domain**
- [ ] `lib/projects.ts` — `listProjects(workspaceId)`, `getProject(projectId)`, `createProject({ workspaceId, name, description })`, `deleteProject(projectId)`
- [ ] `lib/validation/project.ts` — Zod schemas

**Pages**
- [ ] `app/(app)/projects/page.tsx` — list view with `<UsageBar>` (placeholder until 2.3) at top + Create button
- [ ] `app/(app)/projects/new/page.tsx` — create form (Server Action)
- [ ] `app/(app)/projects/[id]/page.tsx` — detail view with delete button (ConfirmDialog)
- [ ] `app/(app)/projects/loading.tsx` — skeleton list

**Shared billing components used here**
- [ ] `components/billing/UpgradePrompt.tsx` — renders when an action returns `code: "LIMIT_EXCEEDED"`, links to `upgradeUrl`

**Cache invalidation**
- [ ] `revalidateTag("projects:" + workspaceId)` after create/delete

### Tests to write in this checkpoint

**`tests/lib/projects.test.ts`**
- `it("listProjects returns projects in workspace")`
- `it("createProject returns LIMIT_EXCEEDED when canCreateProject false")`
- `it("createProject inserts row and increments usage on success")`
- `it("deleteProject removes row and decrements usage")`
- `it("deleteProject returns FORBIDDEN when caller is non-admin member")` (only owner/admin can delete)

**`tests/components/UpgradePrompt.test.tsx`**
- `it("renders nothing when error code is not LIMIT_EXCEEDED")`
- `it("renders with current plan and upgrade target when LIMIT_EXCEEDED")`
- `it("CTA href matches the provided upgradeUrl")`

### Manual verification for this checkpoint
- [ ] Free user creates 3 projects; 4th attempt shows `<UpgradePrompt />` inline
- [ ] Delete a project → can immediately create another
- [ ] Server Action returning `LIMIT_EXCEEDED` renders prompt with correct `upgradeUrl`
- [ ] Loading skeleton shows on `/projects` first load (no empty flash)
- [ ] Mobile: project list + new-project form usable on phone

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 2.2 — projects demo + usage enforcement UI`.

---

## Checkpoint 2.3 — Billing API routes + billing settings page

### What gets built
- 3 billing API routes: `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/cancel`
- `/settings/billing` page — current plan, usage bars, plan comparison, upgrade/cancel buttons
- Components: `PlanBadge`, `UsageBar`, `PricingTable`, `BillingCard`
- Past-due alert when `subscriptions.status = 'past_due'`

### In plain English
The billing page in settings is now real. The user sees their current plan, usage bars showing how many of their projects and members they've used, and the right action buttons for their plan: "Upgrade to Pro" (free users), "Manage billing" (paid users — opens Stripe Customer Portal), and "Cancel subscription" (paid users, with a confirmation). Clicking "Upgrade to Pro" redirects to Stripe Checkout. After paying with a test card, Stripe fires the webhook we built in 2.1, the database updates, and the user returns to a "Welcome to Pro" toast on the billing page. Their unlimited projects unlock immediately. If they cancel via the portal, the page shows a "Cancels on [date]" banner. This is the full billing lifecycle, working in the actual UI.

### Done when
- Full upgrade flow in browser: free user → "Upgrade to Pro" → Stripe Checkout → test card `4242 4242 4242 4242` → returns to `/settings/billing?upgraded=true` → toast "Welcome to Pro" → plan badge says Pro → unlimited projects unlocked
- "Manage billing" opens Stripe Customer Portal in same window for the correct customer
- Cancel from portal → returns to billing page → shows "Cancels on [date]" banner
- All billing API route tests pass; all billing component tests pass
- `npm run test:coverage` ≥ 75%; `npm run build` zero errors
- Full Phase 2 manual verification suite passes

### Tasks

**API routes**
- [ ] `app/api/billing/checkout/route.ts` — auth + Zod + rate-limit + `createCheckoutSession` → return URL
- [ ] `app/api/billing/portal/route.ts` — auth + Zod + rate-limit + `createPortalSession` → return URL
- [ ] `app/api/billing/cancel/route.ts` — auth + owner check + `stripe.subscriptions.update({ cancel_at_period_end: true })` + log activity

**Billing UI**
- [ ] `app/(app)/settings/billing/page.tsx` — current plan card, usage bars, plan comparison, action buttons
- [ ] `components/billing/PlanBadge.tsx` — colored pill for free/pro/enterprise
- [ ] `components/billing/UsageBar.tsx` — progress with used/total, "Unlimited" when null
- [ ] `components/billing/PricingTable.tsx` — three-column comparison + monthly/annual toggle (reused on landing in Phase 5)
- [ ] `components/billing/BillingCard.tsx` — current-plan summary + trial countdown + cancel-at banner

### Tests to write in this checkpoint

**`tests/api/billing-checkout.test.ts`**
- `it("returns 401 when unauthenticated")`
- `it("returns 400 when priceId missing")`
- `it("returns 400 when priceId is not one of the configured prices")`
- `it("returns 429 when rate limited")`
- `it("returns checkout URL on success")`
- `it("uses existing stripe_customer_id when present")`
- `it("sets metadata.workspaceId on session")`

**`tests/api/billing-portal.test.ts`**
- `it("returns 401 when unauthenticated")`
- `it("returns 400 when no stripe_customer_id (free user)")`
- `it("returns portal URL on success")`

**`tests/api/billing-cancel.test.ts`**
- `it("returns 401 when unauthenticated")`
- `it("returns 403 when user is not owner of workspace")`
- `it("calls stripe.subscriptions.update with cancel_at_period_end true")`
- `it("logs activity 'subscription.canceled'")`

**`tests/components/PricingTable.test.tsx`**
- `it("renders three plan columns")`
- `it("shows 'Most popular' badge on Pro")`
- `it("monthly/annual toggle updates displayed prices")`
- `it("each plan has a CTA button")`
- `it("annual toggle shows '/mo billed annually' subline")`

**`tests/components/UsageBar.test.tsx`**
- `it("renders 'used / total' format")`
- `it("bar width equals (used/total)*100 percent")`
- `it("renders 'Unlimited' when maxCount is null")`
- `it("renders red bar fill when at 100%")`
- `it("renders amber bar fill when at >= 80%")`

**`tests/components/BillingCard.test.tsx`**
- `it("renders current plan name and price")`
- `it("renders trial countdown when status is trialing")`
- `it("renders 'Cancels on <date>' when cancel_at_period_end is true")`

### Manual verification for this checkpoint
- [ ] Upgrade flow end-to-end with `4242 4242 4242 4242` → ends on billing page with toast, Pro badge, unlocked projects
- [ ] Verify `subscriptions.stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` all populated after checkout
- [ ] "Manage billing" → portal opens with correct customer
- [ ] Downgrade Pro → Enterprise via portal → webhook updates `plan_name`
- [ ] Cancel via portal → UI shows "Cancels on [date]" banner
- [ ] `stripe trigger invoice.payment_failed` → past-due alert shows on billing page
- [ ] Rate limit: 11 checkout requests in a minute → 11th returns 429
- [ ] Mobile: complete the full upgrade flow on a phone
- [ ] Re-run RLS test on `subscriptions` and `usage` tables

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. **This is the last checkpoint of Phase 2** — also confirm the full billing lifecycle works end to end before declaring the phase complete. Suggested commit: `phase 2.3 — billing API + settings page`.

---

## Coverage target after this phase
Lines ≥ 75% · Functions ≥ 75% · Branches ≥ 70% · Statements ≥ 75%
