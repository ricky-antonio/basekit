# Phase 4 — Admin + Impersonation

**Complete this phase entirely before starting Phase 5.**

## Goal
An admin (a `profiles.role = 'admin'` user) can sign in, view MRR / users / churn metrics, browse and search the user table, drill into a user, manually override a user's plan, impersonate a user (with a persistent banner), and view the activity log. All admin actions are themselves logged.

## Checkpoints

This phase is split into three checkpoints. Execute one per session. End each with the closeout protocol from CLAUDE.md.

- **Checkpoint 4.1 — Admin lib + metrics + API routes.** *Server side of admin works — admin can hit endpoints via curl, metrics compute correctly.*
- **Checkpoint 4.2 — Admin pages + components.** *Admin UI is fully navigable — overview, user table, user detail, plan override all work in the browser.*
- **Checkpoint 4.3 — Impersonation end-to-end.** *Admin can impersonate any user, banner is unmissable, exit returns to admin session, every action is audited.*

---

## Checkpoint 4.1 — Admin lib + metrics + API routes

### What gets built
- `lib/admin.ts` — `listUsers`, `getUserDetail`, `overrideUserPlan`, `listActivity`
- `lib/admin-metrics.ts` — `getMetrics()` returning MRR, ARR, totals, churn, trial conversion, 12-month MRR trend
- Admin auth boundary in `app/(admin)/layout.tsx` + middleware enforcement
- 3 admin API routes: `/api/admin/users` (list), `/api/admin/users/[id]` (detail + plan override), `/api/admin/metrics`

### In plain English
The server side of the admin section is built and gated. Non-admins visiting any `/admin/*` URL get redirected to the dashboard with a toast. Admins can hit the API endpoints (via curl with their bearer token) and get back paginated users, full user detail, and the metrics dashboard data. Metric calculations (MRR, churn, trial conversion) run against real database data, normalising annual plans to per-month MRR. The plan-override action writes to `subscriptions` and also writes an `activity_log` row capturing who did it and why. No admin UI yet — that's 4.2.

### Done when
- Visiting any `/admin/*` URL as a non-admin → redirected to `/dashboard` with toast
- Visiting `/admin/*` as admin → loads (placeholder pages OK in this checkpoint)
- `GET /api/admin/users` returns paginated list; supports `?search=` + `?plan=` + `?status=`
- `GET /api/admin/users/:id` returns user + subscription + workspace + recent activity
- `PATCH /api/admin/users/:id` with `{ plan: 'pro', reason: '...' }` overrides plan + logs activity
- `GET /api/admin/metrics` returns correctly computed MRR/ARR/churn/breakdown for seeded test data
- All admin lib + admin API tests pass
- `npm run test:coverage` ≥ 82%; `npm run build` zero errors

### Tasks

**Admin lib**
- [ ] `lib/admin.ts` — `listUsers({ search, plan, status, page })`, `getUserDetail(userId)`, `overrideUserPlan(userId, plan, reason)`, `listActivity({ page, action, workspaceId })`
- [ ] `lib/admin-metrics.ts` — `getMetrics()` computing `mrr`, `arr`, `totalUsers`, `activeSubscribers`, plan counts, `churnRate30d`, `trialConversionRate`, `mrrTrend12m`

**Admin auth boundary**
- [ ] `app/(admin)/layout.tsx` — `requireAdmin()`; on fail, redirect to `/dashboard` with toast "Admin access required"
- [ ] Extend `middleware.ts` to also enforce `/admin/*` (defence in depth)

**API routes**
- [ ] `app/api/admin/users/route.ts` — GET paginated, searchable. Rate-limited.
- [ ] `app/api/admin/users/[id]/route.ts` — GET full detail, PATCH plan override. Rate-limited.
- [ ] `app/api/admin/metrics/route.ts` — GET. 60s revalidate. Rate-limited.

### Tests to write in this checkpoint

**`tests/lib/admin.test.ts`**
- `it("listUsers returns paginated users")`
- `it("listUsers filters by plan")`
- `it("listUsers filters by status")`
- `it("listUsers search matches email and display_name")`
- `it("getUserDetail returns user + subscription + workspace + recent activity")`
- `it("getUserDetail returns NOT_FOUND for missing user")`
- `it("overrideUserPlan updates subscriptions.plan_name")`
- `it("overrideUserPlan logs activity admin.plan_override")`
- `it("overrideUserPlan returns FORBIDDEN when caller is not admin")`

**`tests/lib/admin-metrics.test.ts`**
- `it("getMetrics returns 0 MRR when no paid subscriptions")`
- `it("MRR includes pro_monthly * 29 and pro_annual * 23 (per-month normalised)")`
- `it("MRR excludes canceled subscriptions")`
- `it("MRR includes trialing subscriptions")`
- `it("plan breakdown counts each plan correctly")`
- `it("churnRate30d = canceled in last 30 days / active at start of period")`
- `it("mrrTrend12m returns 12 entries oldest-first")`

**`tests/api/admin-users.test.ts`**
- `it("returns 401 when unauthenticated")`
- `it("returns 403 when authenticated but not admin")`
- `it("returns 200 with paginated users when admin")`
- `it("respects ?search query param")`
- `it("respects ?plan filter")`

**`tests/api/admin-users-id.test.ts`**
- `it("GET returns full user detail")`
- `it("PATCH overrides plan when admin")`
- `it("PATCH returns 403 when not admin")`
- `it("PATCH returns 400 when plan is invalid")`

### Manual verification for this checkpoint
- [ ] Promote your account to admin (SQL: `update profiles set role='admin' where id='...'`)
- [ ] Non-admin visiting `/admin` → redirected to `/dashboard` with toast
- [ ] Admin curl hitting `/api/admin/users` → results
- [ ] PATCH plan override → `subscriptions.plan_name` updated → `activity_log` has `admin.plan_override` with metadata
- [ ] `/api/admin/metrics` returns expected MRR for test data
- [ ] RLS: `activity_log` readable to admins only (verify via SQL with a non-admin token)

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 4.1 — admin lib + metrics + API`.

---

## Checkpoint 4.2 — Admin pages + components

### What gets built
- `/admin` overview page: 4 metric cards + revenue chart + plan breakdown + recent activity
- `/admin/users` paginated, searchable, filterable user table
- `/admin/users/[id]` user detail page with override action
- `/admin/subscriptions` list with status filter, deep-link to Stripe customer
- `/admin/activity` paginated activity log with action filter
- All admin components except impersonation (deferred to 4.3)

### In plain English
The admin dashboard is now a real navigable UI. Metric cards show MRR, total users, active subscribers, and churn. A revenue chart shows the last 12 months. The user table is searchable by email/name, filterable by plan and status, and paginated. Clicking a user opens their detail page where the admin can manually override their plan via a confirmation dialog with a reason field. The subscriptions page lists all active subs with deep links to Stripe. The activity log page surfaces every audited action. Charts are dynamically imported so the admin section doesn't bloat the main bundle. No impersonation yet — that's 4.3.

### Done when
- `/admin` loads with real metrics from DB (no mocks)
- User table search/filter updates URL params and refetches
- Override plan dialog works end to end → user's `/settings/billing` reflects new plan immediately
- Activity log page paginated and filterable
- Charts dynamically imported (verify with build output bundle analysis)
- Mobile: tables collapse to card layout, charts hide gracefully if too narrow
- All admin component tests pass
- `npm run test:coverage` ≥ 82%; `npm run build` zero errors

### Tasks

**Pages**
- [ ] `app/(admin)/admin/page.tsx` — overview
- [ ] `app/(admin)/admin/users/page.tsx` — paginated table + search + filters
- [ ] `app/(admin)/admin/users/[id]/page.tsx` — full detail + override action
- [ ] `app/(admin)/admin/subscriptions/page.tsx` — list with status filter
- [ ] `app/(admin)/admin/activity/page.tsx` — paginated activity log
- [ ] `app/(admin)/admin/loading.tsx` — skeleton dashboard

**Components**
- [ ] `components/admin/AdminMetrics.tsx` — 4-card row, color-accented per metric
- [ ] `components/admin/RevenueChart.tsx` — line chart of `mrrTrend12m`. **Dynamic import** with `{ ssr: false }` + Skeleton fallback. Install `recharts` if needed.
- [ ] `components/admin/PlanBreakdown.tsx` — horizontal bar of free/pro/enterprise with counts + percentages
- [ ] `components/admin/RecentActivity.tsx` — last 20 activity_log rows
- [ ] `components/admin/UserTable.tsx` — paginated. Virtualise with `@tanstack/react-virtual` if >100 rows.
- [ ] `components/admin/UserDetailHeader.tsx` — avatar, name, email, badges, action buttons
- [ ] `components/admin/PlanOverrideDialog.tsx` — select plan + reason text + confirm button

### Tests to write in this checkpoint

**`tests/components/AdminMetrics.test.tsx`**
- `it("renders 4 metric cards")`
- `it("formats MRR as currency")`
- `it("formats churn as percentage")`

**`tests/components/UserTable.test.tsx`**
- `it("renders rows with avatar, name, email, plan badge")`
- `it("pagination controls navigate")`
- `it("search input updates URL")`
- `it("filter selects update URL")`

**`tests/components/PlanOverrideDialog.test.tsx`**
- `it("disables Confirm until plan + reason provided")`
- `it("calls onConfirm with selected plan and reason")`
- `it("closes on cancel without calling onConfirm")`

**`tests/components/PlanBreakdown.test.tsx`**
- `it("renders 3 segments with correct widths")`
- `it("shows percentages")`

### Manual verification for this checkpoint
- [ ] `/admin` overview loads with real data (seed 2-3 test workspaces with various plans first)
- [ ] Search by email → URL updates with `?search=...`
- [ ] Plan filter narrows results
- [ ] Pagination works (seed >50 users for the test if needed)
- [ ] User detail page shows correct workspace + subscription + last 20 activities
- [ ] Override plan → DB updates → user immediately sees new plan on `/settings/billing`
- [ ] Override creates `activity_log` row with metadata
- [ ] Mobile: dashboard usable, tables convert to cards
- [ ] Revenue chart renders without breaking even at 0 data points
- [ ] Build output confirms `RevenueChart` is in a separate chunk (dynamic import working)

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 4.2 — admin pages + components`.

---

## Checkpoint 4.3 — Impersonation end-to-end

### What gets built
- `lib/impersonation.ts` — `startImpersonation`, `endImpersonation`, `getImpersonationContext`
- 2 impersonation API routes: `/api/admin/users/[id]/impersonate` (POST), `/api/admin/impersonate/end` (POST)
- `<ImpersonateBanner>` integrated into both `(app)` and `(admin)` layouts
- `lib/auth.ts` `getUser()` updated to honor impersonation cookie when admin
- Activity log entries for `admin.impersonation_started` + `admin.impersonation_ended`

### In plain English
An admin can now click "Impersonate" on any user detail page. The app immediately shows that user's data instead of the admin's — their workspace, their projects, their billing, everything. A red banner pinned to the top of every page makes it impossible to forget you're impersonating, with a one-click "Exit" button. The activity log captures both the start and end of every impersonation session, recording both the admin who did it and the target user. The cookie itself is httpOnly, signed, and expires after a short window — even if the admin closes the tab and walks away, the impersonation auto-ends.

### Done when
- Admin clicks "Impersonate" on user detail → POST `/api/admin/users/[id]/impersonate` → cookie set → redirect → app reloads as target user
- `<ImpersonateBanner>` renders at top with target user's email, on top of every other UI (`z-impersonate-banner`)
- Admin sees target user's actual data (workspace, projects, subscription)
- Click "Exit" → POST `/api/admin/impersonate/end` → cookie cleared → redirect to `/admin/users/[id]`
- `activity_log` captures both start and end with `impersonator_id` set on each row
- Cookie expiry works (manually backdate cookie → next request treats as not impersonating)
- Non-admin attempting POST → 403
- All impersonation tests pass
- `npm run test:coverage` ≥ 82%; `npm run build` zero errors
- Full Phase 4 manual verification suite passes

### Tasks

**Impersonation lib + routes**
- [ ] `lib/impersonation.ts` — `startImpersonation(adminId, targetUserId)`, `endImpersonation()`, `getImpersonationContext()`. Cookie payload is signed JWT containing `{ targetUserId, adminId, expiresAt }`.
- [ ] `app/api/admin/users/[id]/impersonate/route.ts` — POST. `requireAdmin` → start → log activity. Rate-limited (5/min/admin).
- [ ] `app/api/admin/impersonate/end/route.ts` — POST. Clears cookie. Logs activity.

**Auth integration**
- [ ] Update `lib/auth.ts` `getUser()` to check for impersonation cookie when caller is admin — return impersonated user, keep impersonator context available via `getImpersonationContext()`
- [ ] Render `<ImpersonateBanner>` in `app/(app)/layout.tsx` and `app/(admin)/layout.tsx` (only when context present)

**Component**
- [ ] `components/admin/ImpersonateBanner.tsx` — top-of-screen, full-width, danger color, "Impersonating <email>" + "Exit" button. `z-impersonate-banner`.
- [ ] Wire the "Impersonate" button on `app/(admin)/admin/users/[id]/page.tsx` (component itself was built in 4.2, this checkpoint connects it)

### Tests to write in this checkpoint

**`tests/lib/impersonation.test.ts`**
- `it("startImpersonation sets a cookie with signed payload")`
- `it("startImpersonation returns FORBIDDEN when caller is not admin")`
- `it("getImpersonationContext returns null when no cookie")`
- `it("getImpersonationContext returns context when cookie valid and not expired")`
- `it("getImpersonationContext returns null when cookie expired")`
- `it("getImpersonationContext returns null when cookie signature invalid")`
- `it("endImpersonation clears the cookie")`

**`tests/api/admin-impersonate.test.ts`**
- `it("POST returns 403 when not admin")`
- `it("POST sets impersonation cookie on success")`
- `it("POST logs activity")`
- `it("end POST clears cookie and logs activity")`

**`tests/components/ImpersonateBanner.test.tsx`**
- `it("renders nothing when no impersonation context")`
- `it("renders banner with target user email when active")`
- `it("clicking Exit calls end-impersonation endpoint")`

### Manual verification for this checkpoint
- [ ] Impersonate a user → app immediately shows their data
- [ ] Banner renders on top of every other UI (verify on pages with dropdowns/dialogs open)
- [ ] Banner remains visible after scroll, route change, even after opening modals
- [ ] Click "Exit" → returns to your own admin account, lands on user detail page
- [ ] `activity_log` has both start + end rows with `impersonator_id` correctly set
- [ ] Cookie expiry: manually edit expiry on cookie → next request reverts to admin context
- [ ] Non-admin attempting POST to `/api/admin/users/[id]/impersonate` → 403
- [ ] Rate limit: 6 impersonation starts in a minute → 6th returns 429

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. **Last checkpoint of Phase 4** — confirm the full admin suite (metrics, search, override, impersonate, exit, activity audit) works end to end. Suggested commit: `phase 4.3 — impersonation end-to-end`.

---

## Coverage target after this phase
Lines ≥ 82% · Functions ≥ 82% · Branches ≥ 77% · Statements ≥ 82%
