# Decisions

Every non-obvious architectural choice with its rationale and rejected alternatives.
Add an entry here whenever a meaningful decision is made — during planning or mid-build.

---

## Accepted postcss XSS advisory (transitive via Next 15)
**Decision:** Accept the moderate-severity `postcss <8.5.10` XSS advisory rather than running `npm audit fix --force`. Do not override the postcss version via package.json `overrides`.
**Why:** The vulnerability (`GHSA-qx2v-qp2m-jg93`) is exploitable only when **untrusted CSS** is processed via postcss's stringify output. Every line of CSS in this project is authored by us — Tailwind utilities + our own `globals.css` — never user-supplied. The fix `npm audit fix --force` proposes (downgrading Next to `9.3.3`) would destroy the project. The actual fix lives upstream in Next 16.3+ which we cannot adopt without revisiting the Next 15 pin. Will re-evaluate when we revisit Next 16.
**Alternatives rejected:**
- `npm audit fix --force` — destructive Next downgrade.
- Adopt Next 16 to pull in the postcss fix — see "Pinned Next.js 15 instead of accepting 16".
- Override postcss via package.json `overrides` — fragile; Next uses postcss internals that may not survive a major postcss bump.
**Date:** 2026-05-27

---

## Pinned Next.js 15 instead of accepting 16
**Decision:** Pin `next` and `eslint-config-next` to `15.x` even though `npm install next` resolves to `16.2.6` (latest stable as of the scaffold install).
**Why:** All architecture docs (`.claude/architecture.md`, `.claude/rules/code.md`, the phase files) were written against Next.js 15 patterns. `create-next-app@16` installs an `AGENTS.md` that explicitly warns *"This is NOT the Next.js you know — breaking changes; read `node_modules/next/dist/docs/` before writing any code."* Adopting 16 would mean reading and reconciling those changes against our existing patterns BEFORE the first checkpoint could start — an unscoped detour. Pinning 15 keeps the project on the version the docs were written against. Evaluate 16 as a post-v1 upgrade.
**Alternatives rejected:**
- Adopt Next 16 and revise CLAUDE.md + `.claude/architecture.md` to match — viable but adds an unbounded reading + revision pass before phase 1.1 work can start.
- Accept 16 silently — the framework's own AGENTS.md disagrees with this approach, and we would carry hidden assumption mismatches into every checkpoint.
**Date:** 2026-05-27

---

## Next.js 15 App Router with Server Components + Server Actions
**Decision:** Use App Router exclusively. Default every component to a Server Component. Use Server Actions for mutations. Reach for client components only when there is genuine interactivity (forms, modals, charts).
**Why:** Eliminates the need for a global client store or TanStack Query for most flows. Data is fetched on the server where service role / Supabase SSR helpers already live, so we never have to ship data-fetching wiring to the client. Faster initial paint, smaller JS bundle, less code to maintain.
**Alternatives rejected:**
- TanStack Query everywhere — useful for live admin metrics, but added complexity for the 90% of the app that is request/response.
- Zustand for shared client state — no cross-component state warrants it in v1.
- Pages Router — Server Actions and streaming are App Router-only and we want them.
**Date:** 2026-05-27

---

## Supabase (Postgres + Auth + Storage) over multiple vendors
**Decision:** Use Supabase for the database, authentication, and avatar storage. RLS is the primary authorization layer.
**Why:** Single vendor, single dashboard, single set of credentials per environment. RLS forces every query to declare its access predicate, which is structurally safer than middleware-only auth. Built-in SSR helpers (`@supabase/ssr`) compose cleanly with the App Router.
**Alternatives rejected:**
- Prisma + Postgres + Clerk + S3 — four vendors to wire and bill for, three sets of webhooks to verify, no RLS.
- Drizzle + Supabase — adds an ORM layer on top of Postgres for marginal benefit; loses the postgrest API and RLS-aware types.
**Date:** 2026-05-27

---

## Stripe Checkout + Customer Portal (no custom billing UI)
**Decision:** Users go through Stripe's hosted Checkout for new subscriptions and Stripe's Customer Portal for plan changes, card updates, invoice history, and cancellation.
**Why:** Stripe owns PCI scope, dunning emails, tax calculation (Stripe Tax), and 3DS challenges. We own only the webhook handler and the `plan_name` derivation from `price_id`. This is the single biggest scope reduction in the project.
**Alternatives rejected:**
- Custom checkout with Stripe Elements — gives finer UX control but pulls PCI scope and 3DS handling into our codebase.
- Direct API subscription creation without Checkout — bypasses tax/coupon UI and forces us to rebuild dunning.
**Date:** 2026-05-27

---

## Stripe webhook idempotency via `stripe_events` table
**Decision:** Insert `stripe_events.id` after every successful webhook processing. Check for existing row before processing.
**Why:** Stripe retries delivery for up to 3 days. Reprocessing `checkout.session.completed` would re-grant trial; reprocessing `customer.subscription.deleted` would clobber a re-subscription that happened in between. Idempotency is the contract.
**Alternatives rejected:**
- In-memory dedupe — lost on cold start.
- Trust Stripe's retry semantics — they explicitly require consumer-side idempotency.
**Date:** 2026-05-27

---

## Supabase Storage for avatars (not S3 / Cloudinary)
**Decision:** Profile avatars live in a Supabase Storage bucket named `avatars`, public-read, 2MB max, image/* MIME only.
**Why:** Already in the vendor list. No extra credentials, no extra bill, RLS-style policies, signed URLs available if we need them later.
**Alternatives rejected:**
- Cloudinary — better transformations but more vendor sprawl for a v1 SaaS demo.
- S3 + CloudFront — cheapest at scale but most setup work.
**Date:** 2026-05-27

---

## Upstash Ratelimit + Redis for rate limiting
**Decision:** Rate limiting on auth routes (10 / 15 min / IP), webhook routes, and all expensive mutations.
**Why:** Edge-runtime compatible, serverless-friendly, no separate Redis to host. Pay-per-request billing aligns with the rest of the stack.
**Alternatives rejected:**
- In-memory rate limiting — broken on serverless cold start.
- Self-hosted Redis on Railway — works but adds an extra service and credit-card relationship.
**Date:** 2026-05-27

---

## `activity_log` table from v1
**Decision:** Create an `activity_log` table on day 1. Log impersonation events, member additions/removals, role changes, plan changes, and subscription state changes.
**Why:** Impersonation must be auditable from the moment it exists. Backfilling an activity log later requires reading every other table's history (which we don't keep). Adding the table now costs nothing; adding it later costs all our history.
**Alternatives rejected:**
- Console + Sentry only — not durable, not queryable, not visible to admins.
- Defer to v2 — would require admin to use Stripe + Supabase dashboards directly, defeating the purpose of having an admin UI.
**Date:** 2026-05-27

---

## Fully responsive (mobile-first nav adaptation)
**Decision:** Every page works on mobile. Sidebar collapses to a bottom nav on `<md`. Tables convert to card layouts on `<md`. Stripe Checkout already mobile-optimised.
**Why:** The portfolio demo target is "sign up on your phone, hit the free limit, upgrade, invite a teammate, cancel." If any of those is desktop-only, the demo fails.
**Alternatives rejected:**
- Desktop-first, mobile-tolerant — half-baked mobile UX hurts the portfolio more than skipping mobile entirely.
- Mobile-only — pricing comparison and admin dashboard need desktop real estate.
**Date:** 2026-05-27

---

## Full dark mode coverage via next-themes
**Decision:** App and landing both support light and dark. `next-themes` with `system` default and a user toggle in `/settings/profile`. All colors expressed as CSS variables in `globals.css`.
**Why:** SaaS landing pages are now expected to support dark mode. Splitting "landing is dark, app is light" is more design debt than just owning both. CSS variables make the cost linear, not multiplicative.
**Alternatives rejected:**
- Landing-only dark mode — inconsistent feel and double design system.
- Light-only — looks dated for a 2026 SaaS demo.
**Date:** 2026-05-27

---

## Server-side Zod validation on every API route
**Decision:** Every API route handler and every Server Action validates its input with Zod before any DB call. Webhook payloads are validated against a per-event Zod schema after signature verification.
**Why:** Client validation is UX; server validation is correctness and security. Zod schemas double as TypeScript types via `z.infer`, removing the duplicate-definition tax.
**Alternatives rejected:**
- Manual `if (typeof x !== "string")` checks — easy to miss a field.
- Yup / Joi — Zod has better TS inference and is the de-facto choice in the Next.js ecosystem.
**Date:** 2026-05-27

---

## Sentry for webhook and API error tracking
**Decision:** Wire `@sentry/nextjs` for server-side error capture. Every `catch` in a webhook handler or API route calls `Sentry.captureException(error)` before responding.
**Why:** Webhook handlers return 200 to Stripe even on internal failure (to avoid retry storms). Without external error tracking we'd have no way to know a webhook silently failed. Sentry replaces the `console.error` + `// TODO: real observability` antipattern.
**Alternatives rejected:**
- Console logs in Vercel — only retrievable by manual log search, no aggregation, no alerting.
- Self-hosted GlitchTip — adds an ops dependency for no meaningful saving.
**Date:** 2026-05-27

---

## Plan limits defined as code in `lib/plans.ts`, not DB rows
**Decision:** Plans (`free`, `pro`, `enterprise`) and their limits live in a TypeScript `const` map. They are not stored in the database.
**Why:** Plans change rarely and changes need code review. Storing them in the DB invites runtime mutation bugs and removes type safety. Limits being typed lets the entire usage-enforcement layer be fully type-checked.
**Alternatives rejected:**
- `plans` DB table — supports admin self-serve plan editing, which is explicitly a non-goal for v1.
- Hardcoded in each call site — duplication, drift risk.
**Date:** 2026-05-27

---

## Five phases, demoable at every cut
**Decision:** Build in 5 phases — Foundation+Auth, Billing+Usage, Team+Email, Admin+Impersonation, Landing+Polish — with each phase having a natural demoable stopping point.
**Why:** The portfolio claim is "this is the foundation every SaaS needs." A scaffold that doesn't compose into demoable slices defeats the portfolio narrative. Five phases also map cleanly to the 27-step build order in the original CLAUDE.md.
**Alternatives rejected:**
- One mega-phase — no checkpoint, no recovery, no demo until the end.
- Six granular phases — Foundation and Auth are tightly coupled; splitting them adds a synthetic boundary.
- Four phases (collapse Team+Admin) — too much surface area in one phase, breaks the "demoable at every cut" rule.
**Date:** 2026-05-27

---

## Coverage thresholds rise across phases
**Decision:** Start at 70 / 70 / 65 (lines / functions / branches) for Phase 1, raise by 3-5 points per phase, target 85 / 85 / 80 by Phase 5.
**Why:** Phase 1 has more scaffolding code (auth callbacks, supabase clients) that is hard to test without integration infra. As the app matures, the testable surface grows faster than the un-testable surface. Forcing 85% on day one would produce ceremonial tests.
**Alternatives rejected:**
- Single 80% threshold from day 1 — leads to tests-for-coverage rather than tests-for-behavior.
- No coverage thresholds — coverage drifts down silently.
**Date:** 2026-05-27

---

## SECURITY DEFINER helper functions to break recursive RLS
**Decision:** RLS policies that need to query their own table (e.g. `workspace_members` checking membership) or that traverse the same table they protect (e.g. `profiles` admin check reading `profiles.role`) call a `SECURITY DEFINER` function instead of inlining the subquery. Two helpers live alongside the policies: `get_user_workspace_ids(p_user_id uuid)` and `is_admin(p_user_id uuid)`. Both `SET search_path = public` to prevent search-path attacks.
**Why:** Postgres' RLS evaluator re-applies the policy when a policy's USING clause queries the same table, producing `42P17: infinite recursion detected in policy`. We hit this during the Checkpoint 1.1 RLS verification: `members_select_same_workspace` queried `workspace_members` to check membership, and `profiles_select_admin` queried `profiles` to check role. SECURITY DEFINER bypasses RLS for the inner lookup (the function runs as the function's owner, postgres), so the membership/admin check happens once and the result is fed back into the policy.
**Alternatives rejected:**
- Store `is_admin` as a column on `auth.users.raw_app_meta_data` and read via `auth.jwt()` — couples role to JWT lifecycle (role changes require token refresh) and pushes a Supabase-internal pattern we'd have to maintain.
- Drop the cross-table policies and enforce in app code — defeats the purpose of RLS as the authorization layer (`code.md` rule: "RLS is the authorization layer").
- Use Postgres views with `security_invoker = false` — works but adds another abstraction layer to maintain; the function approach is the Supabase-recommended pattern for exactly this case.
**Date:** 2026-05-28

---

## Column-level grants to prevent profile role escalation
**Decision:** Revoke broad UPDATE on `profiles` from `authenticated` and re-grant only `(display_name, avatar_url)`. Role changes go through service-role server actions exclusively.
**Why:** The `profiles_update_own` RLS policy is `USING (id = auth.uid())` — it restricts WHICH rows a user can update but not WHICH columns. Without column-level grants, a regular authenticated user could `update profiles set role = 'admin' where id = me` from the Supabase client and grant themselves admin. Found during the Phase 1.1 RLS audit. Column-level grants are the standard PostgreSQL pattern for "you can edit your row, but not these columns."
**Alternatives rejected:**
- `WITH CHECK (id = auth.uid() AND role = (select role from profiles where id = auth.uid()))` — works but reads as "compare role to itself," creates a self-query that's another recursion risk surface, and needs a helper.
- A trigger that rejects role changes by non-superusers — adds runtime overhead and is hidden behavior; column grants are declarative and visible in `\dp`.
- Move `role` to `auth.users.raw_app_meta_data` — couples role to JWT lifecycle (role changes require token refresh) and is a Supabase-internal pattern we'd have to maintain.
**Date:** 2026-05-28

---

## `is_workspace_owner_or_admin` helper for cross-table membership checks
**Decision:** Five policies that previously inlined `EXISTS (SELECT 1 FROM workspace_members WHERE ... AND role IN ('owner', 'admin'))` now call `is_workspace_owner_or_admin(workspace_id, user_id)` — a SECURITY DEFINER helper that bypasses RLS for the lookup. Applies to `members_update_owner_or_admin`, `members_delete_owner_or_admin`, `invitations_insert_owner_or_admin`, `invitations_delete_owner_or_admin`, `projects_delete_owner_or_admin`.
**Why:** The inlined `select 1 from workspace_members ...` queries triggered the SELECT policy on `workspace_members`, which itself uses `get_user_workspace_ids` (SECURITY DEFINER). So they worked — but only because of the helper one level down. If anyone modified `members_select_same_workspace` to inline the membership check, all 5 callers would recurse. Routing through a dedicated helper makes the protection explicit and removes the implicit dependency on another policy's implementation. Also slightly faster — one fewer round of policy evaluation per row.
**Alternatives rejected:**
- Keep the inlined exists clauses — works today but fragile to future policy edits.
- Inline `is_workspace_owner_or_admin`'s body into each policy — duplicates logic 5 times; one source of truth is cheaper to maintain.
**Date:** 2026-05-28

---

## Explicit table grants for SQL-Editor-created tables
**Decision:** `combined.sql` ends with explicit grants for BOTH `authenticated` and `service_role`: `GRANT USAGE ON SCHEMA public ...; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public ...; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public ...` to each role.
**Why:** Tables created via the Supabase Dashboard's Table Editor automatically get the right grants for the `authenticated` and `anon` roles via Supabase's UI tooling. Tables created via raw SQL in the SQL Editor do NOT — the SQL Editor runs as `postgres` and grants are not applied automatically. Without these grants, even a correctly-RLS-policied query fails with `42501: permission denied for table workspaces`. We hit this during Checkpoint 1.1 RLS verification. RLS still acts as the row filter — the grant is just the table-level privilege check that happens before RLS even runs.
**Update (2026-05-28, Phase 1 verification):** The original grants covered only `authenticated`. During the Phase 1 manual verification gate, a live PostgREST probe revealed `service_role` was getting `42501 permission denied` on **every** public table — `service_role` had never been granted. This is a distinct trap from the `authenticated` case: `service_role` carries `BYPASSRLS`, which skips *row-level policies* but NOT *table-level privileges*, so it still needs explicit grants. The gap silently broke `logActivity` (best-effort, so it only surfaced in Sentry) and would have made the Phase 2 Stripe webhook handler's `subscriptions.upsert` fail outright. Fixed by adding the three `... TO service_role` grants. `service_role` deliberately gets full UPDATE on `profiles` (unlike `authenticated`, which is column-restricted) because admin role changes run server-side through the service-role client.
**Alternatives rejected:**
- Create tables via the Supabase Dashboard UI — loses version control, can't be replayed in CI or on a fresh project.
- Use the Supabase CLI (`supabase db push`) which does apply correct grants — requires the user to set up local Supabase tooling for what is otherwise a copy-paste SQL Editor flow. Add as an option later when we ship Supabase migrations as a directory rather than `combined.sql`.
- Rely on `BYPASSRLS` to also cover table privileges for `service_role` — it does not; row-security bypass and table-privilege checks are independent in Postgres.
**Date:** 2026-05-28

---

## Email links use `token_hash` + `verifyOtp`; OAuth keeps the `code` flow
**Decision:** The `/callback` route handles two distinct auth entry points. Email links (signup confirmation, password recovery, magic link, email change) arrive with a `token_hash` + `type` and are completed with `supabase.auth.verifyOtp({ type, token_hash })`. OAuth (Google) arrives with a `code` and is completed with `exchangeCodeForSession(code)`. The Supabase email templates are customised to point at `{{ .SiteURL }}/callback?token_hash={{ .TokenHash }}&type=...` instead of the default `{{ .ConfirmationURL }}`.
**Why:** The project uses the PKCE flow (default in `@supabase/ssr`). `exchangeCodeForSession` requires the PKCE `code_verifier` cookie that was set when `signUp`/`signInWithOAuth` ran. For OAuth that cookie is present (sign-in and callback happen in the same browser). For **email confirmation it is not reliably present** — the link is often opened from a mail client, a different tab, or after the cookie has been cleared — so `exchangeCodeForSession` fails with `auth_failed`. We hit this during the Phase 1 verification gate: a real email-confirmation click landed on `/login?error=auth_failed` and the workspace was never bootstrapped (bootstrap runs *after* the exchange). `verifyOtp` with a `token_hash` is the Supabase-recommended SSR pattern for email links — it carries the verification material in the URL and needs no verifier cookie. Recovery links additionally skip workspace bootstrap and route straight to `/reset-password`.
**Alternatives rejected:**
- Keep only the `code` flow + default templates — the broken state we started from; fails for email links opened outside the original browser session.
- Switch the whole client to the implicit flow — delivers tokens in the URL hash, which a server route handler cannot read (the hash is never sent to the server) and is less secure.
- A separate `/auth/confirm` route (as in some Supabase docs) — works, but a single `/callback` that branches on `token_hash` vs `code` is one fewer route and one redirect-safety helper to maintain.
**Operational note:** Because the templates are customised in the Supabase dashboard (not in the repo), a fresh project setup must re-apply them. Captured in `.claude/setup.md` follow-up + PROGRESS.md.
**Date:** 2026-05-28

---

## Server Action body limit raised to 3 MB for 2 MB avatar uploads
**Decision:** Set `experimental.serverActions.bodySizeLimit = "3mb"` in `next.config.ts`. Client form handlers (`ProfileForm`) also pre-validate avatar size/type before sending and wrap the action call in `try/catch/finally`.
**Why:** Avatars are capped at 2 MB (`lib/profile.ts` + bucket policy), but Next.js Server Actions default to a **1 MB** request-body limit. Any 1–2 MB avatar was silently rejected by the framework *before* our handler ran, surfacing as a dev-overlay error and a button stuck on "Uploading…" (the handler `await`ed the action with no `try/catch`, so the `loading=false` reset never fired). Found during the Phase 1 verification gate. The body limit is raised to 3 MB to clear a 2 MB file plus multipart overhead; client-side pre-validation gives an instant friendly rejection for oversize/non-image files (UX) while the server action still re-validates (security); `try/catch/finally` guarantees the loading state always resets per the "silence after a click is a bug" rule.
**Alternatives rejected:**
- Lower the avatar cap to under 1 MB to fit the default — degrades a normal product expectation (profile photos are routinely 1–2 MB).
- Raise the limit only, without client pre-validation — oversize files would still round-trip the full body before the server rejects them, and the picker offers no instant feedback.
- Catch the framework error globally — the per-handler `try/catch/finally` is localised and keeps the loading-state contract obvious at the call site.
**Date:** 2026-05-29

---

## Custom top progress bar (no dependency) for route transitions
**Decision:** A small client component (`components/layout/TopProgressBar.tsx`) in the root layout renders a thin (2px) teal top progress bar with a soft glow + gentle pulse during route transitions. It starts on same-origin anchor clicks, `popstate`, or a programmatic `startTopProgress()` event (used by sign-out, which is a Server Action + redirect rather than an anchor click), trickles, and completes when `usePathname()` changes — with a **120ms reveal delay** so instant/cached navigations never flash. No third-party loader library.
**Why:** The perceived "hang" when switching views is the Server Component navigation round-trip; a top bar is the conventional "something is happening" signal. The codebase already uses `<Link>` for all nav and bans `router.push()`, so intercepting same-origin anchor clicks reliably covers every transition without a dependency (~110 lines). The 120ms delay implements the requirement "show it any time loading is not instant." Colour is `var(--primary)` so it is theme-aware (teal on light + dark); z-index uses a new `--z-progress: 100` token (above all app chrome).
**Alternatives rejected:**
- `nextjs-toploader` / `@bprogress/next` — battle-tested but adds a runtime dependency for what the no-`router.push` constraint lets us do reliably in-house; also keeps `npm audit` surface smaller.
- `useLinkStatus()` (Next 15.3) — scoped to a single `<Link>`; can't drive one global top bar without wrapping every nav link.
- App Router "router events" — there is no global `routeChangeStart` equivalent; start must be inferred from click/popstate.
**Date:** 2026-05-29

---

## Stripe period fields read from `subscription.items.data[0]`, not the subscription
**Decision:** When mapping a Stripe subscription to our `subscriptions` row, `current_period_start` / `current_period_end` are read from `subscription.items.data[0].current_period_start/end` (per-item), while `cancel_at_period_end` and `trial_end` remain at the subscription top level. The Stripe client pins `apiVersion: "2026-05-27.dahlia"`.
**Why:** Stripe moved the billing-period fields off the `Subscription` object onto `SubscriptionItem` in recent API versions, and the installed `stripe@22` types for `2026-05-27.dahlia` no longer expose `current_period_*` on the subscription — reading them there is a compile error, and copying old tutorial code would have produced `undefined` periods at runtime. The `apiVersion` is typed as the literal `LatestApiVersion`, so a mismatched string is itself a TS error; pinning the exact pinned value keeps types and runtime aligned.
**Alternatives rejected:**
- Read `subscription.current_period_end` (pre-2025 shape) — does not type-check and is `undefined` at runtime on this API version.
- Omit `apiVersion` and let the SDK default — works, but pinning makes the contract explicit and surfaces a future SDK bump as a deliberate change.
**Date:** 2026-05-29

---

## Webhook workspace resolution: metadata first, then `stripe_customer_id` lookup
**Decision:** Every webhook handler resolves its workspace via `resolveWorkspaceId()`: prefer `metadata.workspaceId` (stamped on both the Checkout session and `subscription_data.metadata` at checkout time), and fall back to a DB lookup of `subscriptions` by `stripe_customer_id`. Events that resolve to no workspace are logged + `Sentry.captureMessage`'d and skipped (never thrown) so the endpoint still returns 200.
**Why:** Subscription/checkout events carry our metadata, but invoice events (`payment_failed` / `payment_succeeded`) do not — they only reference a `customer`. The customer ID is persisted on first checkout (`getOrCreateStripeCustomer`), so a customer-based lookup covers invoice events without metadata. Stamping metadata in two places means subscription events map even before the customer row is queryable. Graceful-skip (vs throw) is required because `stripe trigger` fixtures and unrelated events legitimately have no matching workspace, and a throw would otherwise be Sentry-noise + a 500.
**Operational note:** `stripe trigger checkout.session.completed` / `invoice.*` create *new* fixtures with no workspace mapping, so they skip by design. To exercise a real DB write from the CLI, add the metadata override (e.g. `--add checkout_session:metadata.workspaceId=<id>`) or drive the events from a real test-mode checkout.
**Alternatives rejected:**
- Customer-lookup only — fails for the first subscription event if it arrives before the customer row is persisted.
- Metadata only — invoice events have no metadata; payment-failed/succeeded would never map.
**Date:** 2026-05-29

---

## Webhook returns 200 on handler failure and does NOT record the event
**Decision:** On a genuine handler error (e.g. a DB write fails), the route Sentry-captures and returns 200, and crucially does **not** insert into `stripe_events`. The `stripe_events` row is written only after `handleStripeEvent` succeeds.
**Why:** Returning non-200 triggers Stripe's retry storm, which the project explicitly avoids (CLAUDE.md key decision). But pairing 200 with "record-after-success" keeps a failed event **replayable** from the Stripe dashboard — because no idempotency row exists, a manual resend reprocesses cleanly. Recording before processing would permanently swallow a failed event (future deliveries would short-circuit as duplicates with no successful write ever having happened).
**Alternatives rejected:**
- Record the event before processing — guarantees exactly-once *attempt* but makes a failed event unrecoverable without manual DB surgery.
- Return 500 on failure — correct for retries in the abstract, but contradicts the no-retry-storm decision and risks Stripe disabling the endpoint after repeated 5xx.
**Date:** 2026-05-29

---

## Canonical Supabase mock extended with write capture
**Decision:** `tests/mocks/supabase.ts` now records every `insert`/`update`/`upsert`/`delete` into a module-level registry, exposed via `getLastWrite(table, op?)` and `getSupabaseWrites()`, cleared by `resetSupabaseMock()`. The chainable builder still returns itself, so existing tests are unaffected.
**Why:** The testing rules require webhook-handler tests to assert "correct table, correct columns, correct values," but the previous mock created a fresh chain per `from()` call, so write-method spies couldn't be inspected after the fact. Extending the single canonical mock (rather than re-declaring an inline builder per test) keeps to the "one canonical mock per service" rule and avoids the inline-mock drift the rules warn against.
**Alternatives rejected:**
- Per-test inline builders (the older `captureInsert()` pattern in `activity.test.ts`) — duplicative, drift-prone, and can't model multiple writes to different tables in one handler.
- Assert only on results/behaviour — insufficient for "assert the exact columns written" required of webhook handlers.
**Date:** 2026-05-29

## Plan access is gated on subscription status, not just `plan_name`
**Decision:** `getActivePlan(workspaceId)` returns `'free'` unless the subscription's `status` is access-granting (`active`, `trialing`, or `past_due`). `canceled` / `incomplete` / `unpaid` all collapse to `free` regardless of the stored `plan_name`. `past_due` deliberately keeps access (Stripe dunning grace).
**Why:** Originally access derived from `plan_name` alone, which is only flipped to `free` on `customer.subscription.deleted`. That left a gap: an `incomplete` subscription (initial/SCA payment never cleared) or an `unpaid` one (dunning exhausted) would keep `plan_name='pro'` and hand out Pro limits without a successful payment. Gating on status closes that without needing every lapse to produce a delete event. `past_due` is intentionally included because Stripe is still retrying — cutting access mid-dunning is worse UX than the small risk of a few hours of unpaid access.
**Alternatives rejected:**
- Plan-name only (original) — grants access on `incomplete`/`unpaid`; an authorization gap.
- Exclude `past_due` too — would yank Pro the instant a renewal charge is late, before Stripe has even retried.
**Date:** 2026-05-29

---

## Post-2.1 webhook/limiter hardening
**Decision:** Four robustness fixes after the 2.1 self-review: (1) the Supabase middleware matcher excludes `api/webhooks` so webhooks never depend on an auth round-trip; (2) `checkRateLimit` fails **open** (allow + Sentry) when Redis is unreachable, rather than throwing; (3) the webhook route pins `export const runtime = "nodejs"` and falls back to `x-real-ip`; (4) `invoice.payment_succeeded` only refreshes `current_period_end` and no longer sets `status` — `customer.subscription.*` events are the sole source of truth for status; empty-line-item subscription payloads are skipped instead of written as `free`. Plan switches *between paid tiers* are logged (`subscription.upgraded`/`downgraded`) from `customer.subscription.updated`; the initial free→paid purchase is logged once by `checkout.session.completed`.
**Why:** Each addressed a way the webhook path could fail or mislead under real conditions — a rate-limiter or auth outage turning every webhook into a retry-storming 500, a Node-only crypto call running on an unexpected edge default, an invoice event stomping a `trialing` status, or a malformed payload silently downgrading a paying customer. The paid-tier-only logging rule avoids the double/zero-log race between the checkout and subscription-created events that both describe the same purchase.
**Alternatives rejected:**
- Fail closed on limiter error — safer against abuse but converts a dependency blip into a full outage; for a webhook it also defeats the "always 200, never retry-storm" contract.
- Log every plan change from both events — double-logs (or zero-logs, depending on event order) the initial purchase.
**Date:** 2026-05-29
