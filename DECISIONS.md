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
