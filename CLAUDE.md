# Basekit

## Required reading
Before writing any code, read these files in order:
1. CLAUDE.md (this file)
2. .claude/rules/testing.md
3. .claude/phases/<current-phase>.md
4. PROGRESS.md

Confirm you have read all four by stating: the current phase, the current checkpoint
within that phase, the last completed task, and the next task. Do not write a single
line of code until this confirmation is complete.

---

**Tagline:** The foundation every SaaS needs to ship.
**Status:** Phase 1 — Foundation + Auth + Workspaces

---

## Brand
- Name: **basekit** — always lowercase in body copy, even at sentence start
- Wordmark: Inter — `base` regular weight (#0A0A0A on light / #FFFFFF on dark) + `kit` 800 weight teal `#0D9488` on light / `#2DD4BF` on dark, letter-spacing -0.02em
- Icon: a minimal 3×3 grid of small teal squares — clean at 16px favicon, suggesting "the building blocks of a SaaS"
- Voice: **direct, technical, confident** — never marketing-fluffy, never apologetic

## Stack
- Next.js 15 (app router, Server Components, Server Actions)
- React 19
- TypeScript 5.x (strict mode, no `any`)
- Tailwind CSS 4.x
- shadcn/ui (neutral base, CSS variables)
- next-themes (system preference + user toggle)
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres + Auth + Storage
- Stripe (`stripe` SDK + Checkout + Customer Portal + webhooks)
- Resend + React Email (`@react-email/components`, `react-email`)
- Upstash Ratelimit + Redis (`@upstash/ratelimit`, `@upstash/redis`)
- Zod (input validation on every API route + webhook payload)
- Sentry (`@sentry/nextjs`) — error tracking for webhooks + API routes
- `@tabler/icons-react`
- `react-hot-toast`
- Vitest + React Testing Library + jsdom (tests)
- GitHub Actions (CI)

## Environment variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY
STRIPE_PRICE_PRO_ANNUAL
STRIPE_PRICE_ENTERPRISE_MONTHLY
STRIPE_PRICE_ENTERPRISE_ANNUAL
RESEND_API_KEY
FROM_EMAIL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
SENTRY_AUTH_TOKEN
NEXT_PUBLIC_SITE_URL
```

## Detailed references
| Topic | File |
|-------|------|
| Pre-build setup & API verification | .claude/setup.md |
| Database schema | .claude/schema.md |
| Design system | .claude/design.md |
| Architecture & patterns | .claude/architecture.md |
| Code standards | .claude/rules/code.md |
| Testing rules | .claude/rules/testing.md |
| Security rules | .claude/rules/security.md |
| Phase 1 — Foundation + Auth + Workspaces | .claude/phases/1-foundation.md |
| Phase 2 — Billing + Webhooks + Usage | .claude/phases/2-billing.md |
| Phase 3 — Team + Invitations + Email | .claude/phases/3-team.md |
| Phase 4 — Admin + Impersonation | .claude/phases/4-admin.md |
| Phase 5 — Landing + Polish + Pre-deploy | .claude/phases/5-polish.md |

## Key decisions
| Decision | Rationale |
|----------|-----------|
| Next.js 15 App Router with Server Components + Server Actions | Data lives on server by default; only opt into client when interactivity demands it. No global store needed. |
| Supabase (Postgres + Auth + Storage) over separate services | One vendor for DB, auth, file storage. RLS replaces middleware-based authorization. |
| Stripe Checkout + Customer Portal (not custom UI) | Stripe owns PCI scope, dunning, tax. We only own webhook handling + plan derivation. |
| `stripe_events` idempotency table | Webhooks retry; processing twice corrupts subscription state. |
| Service role key only in route handlers | Anything client-touchable hits RLS. Service role bypasses RLS — must be locked to server routes. |
| Resend + React Email | Templates as components, type-safe, same DX as the rest of the codebase. |
| Upstash Ratelimit + Redis | Edge-compatible, serverless-friendly, avoids self-hosted Redis. |
| Activity log table from day 1 | Impersonation must be auditable. Cheaper to log everything now than retrofit. |
| Full responsive (mobile bottom nav) | Demo target is "use the full billing lifecycle on a phone." |
| Full dark mode coverage | next-themes + CSS variable tokens. System preference default, user toggle in settings. |
| Zod validation on every API route | Server-side validation is the only validation that matters. Client validation is UX. |
| Sentry for webhook + API errors | Webhooks return 200 to Stripe even on failure (avoid retry loops) — Sentry is how we know. |

## Non-goals for v1
- Custom checkout UI (Stripe Checkout only)
- Self-serve plan creation by users (plans are hardcoded in `lib/plans.ts`)
- Multi-currency billing (USD only)
- Tax/VAT handling beyond what Stripe Tax provides automatically
- Per-seat billing UI for Pro (Enterprise only — and even then deferred to a flag)
- Activity log UI for end users (admin-only viewing in v1)
- SSO / SAML (Enterprise feature, deferred to v2)
- Audit log export / SOC2 paperwork
- API tokens for end users (admin impersonation only)
- i18n (English only)
- Native mobile apps

## Loading & responsiveness
Every user action must produce immediate visible feedback. Silence after a click is a bug.

- Navigation: use `<Link>` for all user-visible nav — never `router.push()` for nav items
- Page loading: every page with a context loading flag must show a skeleton — never an empty flash
- Async buttons: set `loading = true` as the first statement in the handler, before any `await`
- Submit buttons: change label to present-participle ("Saving…", "Inviting…") and set `disabled={true}`
- OAuth/redirect buttons: set `loading = true`, label "Redirecting…" — never reset, browser navigates away
- Destructive actions: require a confirmation step before starting any loading state
- Stripe Checkout redirect: button shows "Redirecting to Stripe…" before navigation

## Scaffold command
Reproduces the initial install from scratch:

```bash
npx create-next-app@latest basekit --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd basekit

npm install \
  @supabase/supabase-js @supabase/ssr \
  stripe \
  resend @react-email/components react-email \
  next-themes \
  @tabler/icons-react \
  react-hot-toast \
  @upstash/ratelimit @upstash/redis \
  zod \
  @sentry/nextjs

npm install -D \
  vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom \
  @types/node

npx shadcn@latest init
# neutral base color, CSS variables: yes

npx shadcn@latest add \
  button badge input textarea label \
  dialog dropdown-menu separator \
  avatar skeleton tabs popover tooltip \
  select switch table form sheet alert
```

## Checkpoint protocol

Within each phase, work is split into **checkpoints** (2-3 per phase). Each checkpoint
is a coherent half-day of work that ends at a demoable, testable state. Execute one
checkpoint per session.

### Selecting the current checkpoint
At session start, after reading the phase file's `## Checkpoints` overview, identify
the next active checkpoint from PROGRESS.md ("Current checkpoint" field). If the prior
checkpoint hasn't been closed out in PROGRESS.md, finish that closeout first — never
start a new checkpoint while a previous one is unclosed.

### Closeout (run at the end of every checkpoint)
When all the checkpoint's "Done when" criteria pass, append to PROGRESS.md under a new
heading `## Checkpoint X.Y closeout — YYYY-MM-DD`:

1. **Planned vs delivered** — copy "What gets built" with ✅ / ⚠️ / ❌ marks; note any deviations
2. **In plain English (delivered)** — revised paragraph: what now works, what differs from the plan, why
3. **Done-when verification** — each criterion with ✅/❌ and the actual measured value (e.g. "Coverage 73% (≥ 70% threshold)")
4. **Test files added/changed** — bullet list (e.g. `tests/lib/usage.test.ts (new)`, `tests/lib/billing.test.ts (extended +4 cases)`)
5. **New DECISIONS.md entries** — one-line summary per entry added this checkpoint, or `(none)`
6. **Deferred items** — anything moved to a later checkpoint, with reason + target checkpoint
7. **Known issues** — anything broken, flaky, or worth flagging (also mirror under PROGRESS.md "Known issues")
8. **What surprised me** — one sentence on anything non-obvious that came up (library quirk, schema gotcha, assumption that didn't hold)

Then **STOP** and prompt the user, verbatim:
> "Checkpoint X.Y complete. Review the closeout above. Ready to commit and clear context before X.Z? Suggested commit: `phase X.Y — <short summary>`."

Do not begin the next checkpoint until the user confirms. Do not run `git commit` yourself
unless explicitly told to.

### Clearing context
Claude cannot clear its own context. After the user confirms and commits, they will
run `/clear` (or start a new session) and re-enter with a prompt like
`continue phase X.Z`. From a fresh session, follow the Required reading sequence again.

---

## Session rules (read every session)

**Start of every session:**
1. Read CLAUDE.md, the current phase file, and PROGRESS.md
2. State out loud: current phase, current checkpoint, last completed task, next task
3. Do not write code until this confirmation is done

**During every session:**
- Authoring order: `types → lib → lib test → component → component test` — no exceptions
- Never move to the next module until the current one's tests pass
- Every async button sets `loading = true` as its very first statement — before any `await`
- Every page gated behind a loading flag shows a skeleton — never an empty list flash
- All nav links use `<Link>` — not `router.push()`
- TypeScript errors must be zero before ending the session
- A new architectural decision is added to DECISIONS.md the moment it is made

**End of every session (all four must pass):**
```bash
npm run type-check
npm test
npm run test:coverage
npm run build
```

Update PROGRESS.md before closing. Commit only after all four pass.

**A broken session (never acceptable):**
- Skipping tests to move faster
- Committing with failing tests or TypeScript errors
- Calling a phase complete without the manual verification checklist
- Writing a component before its lib functions are tested
- "Looks like it works" without running the checklist
