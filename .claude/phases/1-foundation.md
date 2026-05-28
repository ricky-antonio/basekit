# Phase 1 — Foundation + Auth + Workspaces

**Complete this phase entirely before starting Phase 2.**

## Goal
A user can sign up (email/password or Google), receives a verification email, lands in their workspace, sees an empty dashboard, and can update their profile. RLS is verified to isolate workspaces. No billing, no team, no admin yet.

## Checkpoints

This phase is split into three checkpoints. Execute one per session. End each with the closeout protocol from CLAUDE.md; do not start the next without user confirmation.

- **Checkpoint 1.1 — Database + lib foundation + test mocks + Sentry.** *Foundation slab — DB exists, helper functions tested, error tracking wired. App doesn't run yet.*
- **Checkpoint 1.2 — Auth flow end-to-end.** *Front door works — user can sign up via email or Google, verify, and land on a placeholder dashboard with a bootstrapped workspace.*
- **Checkpoint 1.3 — App shell + dashboard + settings skeleton.** *Rooms framed — logged-in user has a real sidebar, topbar, dashboard, and can manage their profile.*

---

## Checkpoint 1.1 — Database + lib foundation + test mocks + Sentry

### What gets built
- Project scaffold + Tailwind/shadcn config + design tokens + global CSS
- vitest config + tests/setup.ts + GitHub Actions CI
- All 12 database migrations applied to dev Supabase
- All lib/* foundation files (types, plans, supabase, auth, workspace, activity, ratelimit, validation)
- All three test mock files (supabase, stripe, resend)
- Sentry wired (client + server + edge configs)

### In plain English
We're laying the foundation slab before any walls go up. By the end, the database exists with all its tables and security rules. Every helper function future code will call is written and covered by tests. Error tracking through Sentry is live so any future bugs get captured immediately. But the app itself doesn't render yet — there are no auth pages, no UI to log into, no front door. If you ran `npm run dev` you'd just see a default Next.js page. Think of it as plumbing and electrical going in before any walls.

### Done when
- All 12 migrations applied to dev Supabase; types generated to `lib/database.types.ts`
- Every lib/* file exists with a `.test.ts` counterpart, all tests passing
- `npm run test:coverage` ≥ 70% (lines/functions/branches/statements)
- `npm run type-check` — zero errors
- `npm run build` — zero errors
- Sentry captures a deliberate test error from dev within 30s
- The two-account RLS test from `.claude/setup.md` section 12 passes for all created tables (`profiles`, `workspaces`, `workspace_members`, `invitations`, `subscriptions`, `usage`, `projects`, `activity_log`)

### Tasks

**Infrastructure & scaffolding**
- [ ] Run the scaffold command from `CLAUDE.md` (Next.js + Tailwind + shadcn)
- [ ] Configure `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- [ ] Configure Tailwind with the design tokens from `.claude/design.md` (`@theme` block)
- [ ] Set up `app/globals.css` with light + dark CSS variables
- [ ] Wire `next-themes` with system default + user toggle, `suppressHydrationWarning` on `<html>`
- [ ] Add `<Toaster />` from `react-hot-toast` to root layout
- [ ] Set up `vitest.config.ts` and `tests/setup.ts` exactly as in `.claude/rules/testing.md`
- [ ] Add npm scripts: `dev`, `build`, `lint`, `type-check`, `test`, `test:watch`, `test:coverage`, `email`
- [ ] Create `.github/workflows/ci.yml` running install + type-check + test + build on every PR

**Database**
- [ ] `supabase/migrations/00_extensions.sql` (pgcrypto)
- [ ] `01_profiles.sql` (table + trigger + RLS policies)
- [ ] `02_workspaces.sql` (table + RLS)
- [ ] `03_workspace_members.sql` (table + RLS)
- [ ] `04_invitations.sql` (table + RLS)
- [ ] `05_subscriptions.sql` (table + RLS + `updated_at` trigger)
- [ ] `06_usage.sql` (table + RLS + `increment_usage` + `decrement_usage` RPCs)
- [ ] `07_projects.sql` (table + RLS)
- [ ] `08_stripe_events.sql` (idempotency table)
- [ ] `09_activity_log.sql` (table + RLS)
- [ ] `10_bootstrap_workspace.sql` (RPC)
- [ ] `11_storage_avatars.sql` (bucket + storage policies)
- [ ] Run all migrations against dev Supabase
- [ ] Generate types: `npx supabase gen types typescript --project-id <id> > lib/database.types.ts`

**Lib foundation**
- [ ] `lib/types.ts` — `ApiError`, `ApiErrorCode`, `ApiResult<T>`, branded IDs, re-export `Database`
- [ ] `lib/plans.ts` — `PLANS` const + `PlanName` + `getPlanFromPriceId(priceId)`
- [ ] `lib/supabase/client.ts` — browser client
- [ ] `lib/supabase/server.ts` — Server Component client + `createServiceClient()`
- [ ] `lib/supabase/middleware.ts` — session refresh middleware
- [ ] `middleware.ts` (root) — wires session refresh + protects `/(app)/*` and `/(admin)/*`
- [ ] `lib/auth.ts` — `getUser()`, `requireAuth()`, `requireAdmin()`
- [ ] `lib/workspace.ts` — `getWorkspace(user)`, `bootstrapWorkspace(userId, email)`
- [ ] `lib/activity.ts` — `logActivity({ ... })`
- [ ] `lib/validation/profile.ts`, `lib/validation/workspace.ts` — Zod schemas
- [ ] `lib/ratelimit.ts` — Upstash setup + `limiters` map + `checkRateLimit`

**Test mocks**
- [ ] `tests/mocks/supabase.ts` — canonical chainable mock factory
- [ ] `tests/mocks/stripe.ts` — canonical Stripe mock (used Phase 2+)
- [ ] `tests/mocks/resend.ts` — canonical Resend mock (used Phase 3+)

**Sentry**
- [ ] Run `npx @sentry/wizard@latest -i nextjs`, accept defaults
- [ ] Confirm `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` exist
- [ ] Throw a deliberate test error from a Server Component — confirm Sentry receipt

### Tests to write in this checkpoint

**`tests/lib/plans.test.ts`**
- `it("Free plan has 3 project limit")`
- `it("Pro plan has null project limit (unlimited)")`
- `it("Enterprise plan has null member limit")`
- `it("getPlanFromPriceId returns 'pro' for pro monthly env price ID")`
- `it("getPlanFromPriceId returns 'pro' for pro annual env price ID")`
- `it("getPlanFromPriceId returns 'enterprise' for enterprise monthly")`
- `it("getPlanFromPriceId returns 'free' for unknown price ID")`
- `it("Free plan features only include 'email_auth'")`

**`tests/lib/auth.test.ts`**
- `it("getUser returns user when session exists")`
- `it("getUser returns null when no session")`
- `it("requireAuth returns ok=true with user when authenticated")`
- `it("requireAuth returns ok=false with UNAUTHENTICATED when not authenticated")`
- `it("requireAdmin returns ok=true when role is admin")`
- `it("requireAdmin returns ok=false with FORBIDDEN when role is user")`
- `it("requireAdmin returns ok=false with UNAUTHENTICATED when no session")`

**`tests/lib/workspace.test.ts`**
- `it("getWorkspace returns the user's single workspace")`
- `it("getWorkspace returns ok=false when user has no workspace yet")`
- `it("bootstrapWorkspace calls the RPC with derived slug")`
- `it("bootstrapWorkspace returns ok=false on RPC error")`
- `it("bootstrapWorkspace logs an activity event on success")`

**`tests/lib/activity.test.ts`**
- `it("logActivity inserts with required fields")`
- `it("logActivity preserves metadata as JSON")`
- `it("logActivity does not throw if DB write fails (logs + Sentry only)")`

**`tests/lib/ratelimit.test.ts`**
- `it("checkRateLimit returns success when under limit")`
- `it("checkRateLimit returns RATE_LIMITED error when over limit")`
- `it("checkRateLimit error message includes reset time")`

### Manual verification for this checkpoint
- [ ] All 12 migrations applied; verify by SELECTing from each table in SQL Editor
- [ ] `lib/database.types.ts` regenerated; opens without TS errors
- [ ] Run two-account RLS test from `.claude/setup.md` section 12 — record outcome
- [ ] Throw a deliberate test error in a Server Component — Sentry captures within 30s
- [ ] `npm test`, `npm run test:coverage`, `npm run type-check`, `npm run build` all pass

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 1.1 — DB + lib foundation + Sentry`.

---

## Checkpoint 1.2 — Auth flow end-to-end

### What gets built
- All five auth pages: login, signup, verify-email, forgot-password, reset-password
- OAuth + email-verify callback route with `bootstrapWorkspace` on first sign-in
- Rate-limited Server Actions for login, signup, password reset
- A placeholder `/dashboard` page (greeting + workspace name) — fleshed out in 1.3
- Same-email merge between email-password and Google verified end to end

### In plain English
The front door of the app works. A new visitor can fill in the signup form, get a verification email, click the link, and land on a placeholder dashboard. They can sign in with Google, sign in with email/password if registered, request a password reset, and set a new password. Behind the scenes, when a brand-new user signs up, the database atomically creates their workspace, makes them the owner, sets up their free subscription, and zeroes out their usage counters. There's no real sidebar or navigation yet — just a basic page that proves "who is this user, what workspace do they belong to" is fully wired.

### Done when
- Email signup → verify → callback → workspace bootstrapped → redirected to `/dashboard`
- Google signup → callback → workspace bootstrapped → redirected to `/dashboard`
- Same-email merge: signup email/password, verify, sign out, "Continue with Google" with same email → lands on the same workspace
- Rate limit triggers on login (10 / 15 min), signup (10 / 15 min), password reset (5 / hour)
- Visiting `/dashboard` while signed out → redirected to `/login`
- All auth-callback tests pass
- `npm run test:coverage` ≥ 70%; `npm run build` zero errors

### Tasks

**Auth pages**
- [ ] `app/(auth)/layout.tsx` — centered single-column layout with wordmark
- [ ] `app/(auth)/login/page.tsx` — email + password, "Sign in with Google", forgot password link
- [ ] `app/(auth)/signup/page.tsx` — email + password + display name, "Sign up with Google"
- [ ] `app/(auth)/verify-email/page.tsx` — "Check your inbox" landing
- [ ] `app/(auth)/forgot-password/page.tsx` — email input, rate-limited
- [ ] `app/(auth)/reset-password/page.tsx` — new password + confirm
- [ ] `app/(auth)/callback/route.ts` — exchange code, call `bootstrapWorkspace` if first sign-in, redirect to `/dashboard`

**Placeholder app routes (replaced in 1.3)**
- [ ] `app/(app)/layout.tsx` (skeleton) — `requireAuth()`, renders children with no real shell yet
- [ ] `app/(app)/dashboard/page.tsx` (placeholder) — "Hello {displayName}" + workspace name

### Tests to write in this checkpoint

**`tests/api/auth-callback.test.ts`**
- `it("exchanges the code and redirects to /dashboard on first sign-in")`
- `it("calls bootstrap_workspace on first sign-in")`
- `it("does NOT call bootstrap_workspace on subsequent sign-in")`
- `it("redirects to /login?error=... on code exchange failure")`

(Page-level auth forms are simple Server Action wrappers around already-tested `lib/auth.ts` and `lib/workspace.ts` — manual verification covers them.)

### Manual verification for this checkpoint
- [ ] Sign up via email/password — verification email arrives, link works, lands on placeholder `/dashboard`
- [ ] Sign up via Google — lands on `/dashboard`; signing in again does not create a duplicate workspace
- [ ] Same-email merge: email+password signup → verify → sign out → "Continue with Google" with same email → same workspace
- [ ] Rate limit: 11 login attempts in 15 minutes → 11th rejected with friendly error
- [ ] Visit `/dashboard` while signed out → redirected to `/login`
- [ ] Submit signup with malformed email → form shows error before any Supabase call

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 1.2 — auth flow + workspace bootstrap`.

---

## Checkpoint 1.3 — App shell + dashboard + settings skeleton

### What gets built
- AppShell with responsive sidebar (desktop) + bottom nav (mobile) + topbar
- Real dashboard page with workspace info + plan badge + member count
- Settings layout with five pages: profile, workspace, notifications, security, danger
- Avatar upload via Supabase Storage on profile page
- Theme toggle in topbar user menu
- Shared components: PageHeader, EmptyState, ConfirmDialog

### In plain English
The logged-in app finally has rooms. The sidebar shows navigation on desktop and collapses to a bottom nav on mobile. The topbar shows the workspace name plus a user menu with the theme toggle. The dashboard greets the user by name and shows their workspace and plan. The settings pages let them update their display name, upload an avatar, switch themes, change their password, and delete their account. The frame is in place for billing (Phase 2), team management (Phase 3), and admin (Phase 4) — those rooms exist as nav items but the pages themselves are still empty.

### Done when
- Sidebar renders on desktop, bottom nav on mobile; active item highlights from pathname
- Theme toggle persists across reload; respects system preference on first load
- Avatar upload to Supabase Storage works; rejects >2MB and non-image files
- Profile update saves; toast appears; topbar reflects new name
- Password change saves
- Delete account works (calls service-role `auth.admin.deleteUser`)
- All component tests pass
- `npm run test:coverage` ≥ 70%; `npm run build` zero errors
- First-load JS for `/dashboard` < 200KB gzipped (verified in build output)

### Tasks

**App shell**
- [ ] Rewrite `app/(app)/layout.tsx` — `requireAuth()`, fetches workspace + subscription, renders `<AppShell>`
- [ ] `components/layout/AppShell.tsx` — orchestrates sidebar/bottom nav + topbar + content slot
- [ ] `components/layout/Sidebar.tsx` — desktop nav with active highlight
- [ ] `components/layout/MobileNav.tsx` — bottom nav, 5 items, safe-area aware
- [ ] `components/layout/Topbar.tsx` — workspace name, user menu (Profile, Settings, Theme toggle, Sign out)

**Dashboard**
- [ ] Replace placeholder `app/(app)/dashboard/page.tsx` — greets user, shows workspace + plan badge + member count, EmptyState pointing to `/projects/new`
- [ ] `app/(app)/dashboard/loading.tsx` — skeleton

**Shared components**
- [ ] `components/shared/PageHeader.tsx` — H1 + optional subtitle + optional CTA slot
- [ ] `components/shared/EmptyState.tsx` — icon + headline + body + CTA button
- [ ] `components/shared/ConfirmDialog.tsx` — wraps shadcn Dialog with destructive affordance

**Settings**
- [ ] `app/(app)/settings/layout.tsx` — sidebar of settings sections
- [ ] `app/(app)/settings/profile/page.tsx` — display name, avatar upload, theme toggle. Server Action `updateProfile`
- [ ] `app/(app)/settings/workspace/page.tsx` — workspace name + slug
- [ ] `app/(app)/settings/notifications/page.tsx` — "Coming soon" placeholder (built out in Phase 5.2)
- [ ] `app/(app)/settings/security/page.tsx` — password change form
- [ ] `app/(app)/settings/danger/page.tsx` — delete account with ConfirmDialog flow

### Tests to write in this checkpoint

**`tests/components/AppShell.test.tsx`**
- `it("renders the sidebar on desktop")` (use matchMedia mock)
- `it("renders mobile bottom nav on mobile")`
- `it("highlights the active nav item based on pathname")`
- `it("renders the workspace name in topbar")`
- `it("opens the user menu on avatar click")`

**`tests/components/EmptyState.test.tsx`**
- `it("renders headline and body")`
- `it("renders the CTA when actionLabel is provided")`
- `it("does not render CTA when no actionLabel")`

**`tests/components/ConfirmDialog.test.tsx`**
- `it("calls onConfirm when destructive button clicked")`
- `it("Escape closes the dialog")`
- `it("focus returns to trigger after close")`

### Manual verification for this checkpoint
- [ ] Toggle theme → persists across reload, respects system on first load
- [ ] Upload avatar > 2 MB → rejected with friendly error
- [ ] Upload a `.pdf` → rejected by MIME check
- [ ] Update display name → saves, toast appears, topbar updates
- [ ] Tab through the entire app shell with keyboard only — no inaccessible elements
- [ ] Open every modal — Escape closes them all; focus returns to trigger
- [ ] Resize from desktop → mobile — sidebar collapses to bottom nav cleanly
- [ ] Visit `/dashboard` on a phone — bottom nav respects safe-area-inset
- [ ] Visit `/admin` as a regular user → redirected with error toast
- [ ] First-load JS for `/dashboard` < 200KB gzipped

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. **This is the last checkpoint of Phase 1** — also confirm the full Phase 1 manual verification suite (RLS, full auth flows, mobile, a11y) passes before declaring the phase complete. Suggested commit: `phase 1.3 — app shell + dashboard + settings skeleton`.

---

## Coverage target after this phase
Lines ≥ 70% · Functions ≥ 70% · Branches ≥ 65% · Statements ≥ 70%

Set these in `vitest.config.ts` from Checkpoint 1.1 onwards — never lower them later.
