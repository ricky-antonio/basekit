# Deploy runbook — basekit v1.0

The operational checklist for the Checkpoint 5.3 production deploy. Pairs with
[`.claude/setup.md`](.claude/setup.md) (credential sourcing) and [`.claude/phases/5-polish.md`](.claude/phases/5-polish.md)
(the 5.3 task list). Pre-deploy audit results are at the bottom.

---

## 1. Provision production services (separate from dev)

| Service | What to create | Notes |
|---------|----------------|-------|
| **Supabase** | New prod project | Apply `supabase/migrations/combined.sql` in the SQL Editor. Re-apply the Supabase **Confirm signup** + **Reset Password** email templates (they live in the dashboard, not the repo — `{{ .SiteURL }}/callback?token_hash={{ .TokenHash }}&type=...`). Re-run `scripts/rls-verify.mjs` against prod → must be 14/14. **Apply the `notification_preferences` column** (idempotent `alter` is in `combined.sql`). Confirm `service_role` table grants are present. |
| **Stripe** | Prod webhook endpoint → `https://<domain>/api/webhooks/stripe` | Subscribe to the same events used in dev (`checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`). Copy the signing secret → `STRIPE_WEBHOOK_SECRET`. Create the 4 prod price IDs. Configure the Customer Portal (cancel-at-period-end, plan switching). |
| **Resend** | **Verify the production domain** | Long-standing blocker — until verified, custom-`FROM_EMAIL` sends are rejected. Set `FROM_EMAIL` to a verified-domain address. |
| **Upstash** | New prod Redis DB | Copy REST URL + token. Read implicitly via `Redis.fromEnv()`. |
| **Google OAuth** | Add prod redirect URI | `https://<supabase-prod-ref>.supabase.co/auth/v1/callback` + set Supabase Site URL / redirect allow-list to the prod domain. |
| **Sentry** | Prod environment | DSN is currently **hardcoded** in `instrumentation-client.ts` / `sentry.{server,edge}.config.ts` (DSNs are public, so this is safe but means a project swap is a code edit). `SENTRY_AUTH_TOKEN` is needed at **build** time for source-map upload. |

## 2. Vercel environment variables (Production **and** Preview)

Set every var below. All code-read vars are present in `.env.example`; the two ⚙️ rows are read implicitly by SDKs/build, not via `process.env` in our code.

```
NEXT_PUBLIC_SUPABASE_URL            NEXT_PUBLIC_SUPABASE_ANON_KEY       SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY                   STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY            STRIPE_PRICE_PRO_ANNUAL
STRIPE_PRICE_ENTERPRISE_MONTHLY     STRIPE_PRICE_ENTERPRISE_ANNUAL
RESEND_API_KEY                      FROM_EMAIL
NEXT_PUBLIC_SITE_URL   ← MUST include the protocol (https://…) — it feeds `metadataBase: new URL(...)`, which throws at module load if malformed
⚙️ UPSTASH_REDIS_REST_URL           ⚙️ UPSTASH_REDIS_REST_TOKEN   (Redis.fromEnv())
⚙️ SENTRY_AUTH_TOKEN                (build-time source-map upload)
```

Notes:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is in `.env.example` but **not referenced** in code (checkout is a server-side redirect, no client Stripe.js). Safe to omit or keep for future client Stripe.js.
- `SENTRY_DSN` is documented but unused (DSN is hardcoded in the Sentry configs).

## 3. Domain + deploy
- [ ] DNS configured, Vercel domain attached, HTTPS green.
- [ ] First production deploy succeeds.

## 4. Production smoke test (Stripe test cards)
- [ ] signup → email verify → land on `/dashboard?welcome=true`
- [ ] invite a teammate → accept → join
- [ ] upgrade to Pro via Checkout → webhook flips plan → usage limits lift
- [ ] cancel via Customer Portal → `cancel_at_period_end` reflected
- [ ] All 6 emails deliver (verify in Resend logs)
- [ ] Stripe prod webhook receives events (Stripe dashboard)
- [ ] Sentry receives a deliberate prod error
- [ ] Final `scripts/rls-verify.mjs` against prod DB → 14/14

## 5. Lighthouse (live URL)
- [ ] `/` ≥ 90 Perf / ≥ 95 A11y / ≥ 95 BP / ≥ 95 SEO
- [ ] `/dashboard` (logged in) ≥ 90 Perf / ≥ 95 A11y

## 6. Docs
- [ ] README screenshots from production; live URL in README + PROGRESS.
- [ ] Tag `v1.0.0` after the 5.3 closeout commit.

---

## Pre-deploy audit results (2026-06-07 solo prep)

### Bundle budget — fixed the floor; 5 pages remain modestly over
Next's build output is **gzipped** (verified: the Sentry chunk is 416 KB raw on disk but reported as 128 kB = its gzipped size). Trimming Sentry to its CLAUDE.md scope (error tracking only — dropped Session Replay + browser tracing via `instrumentation-client.ts` + `bundleSizeOptimizations` in `next.config.ts`) cut the **shared first-load floor from 223 → 136 kB** and the Sentry chunk from 128 → 78 kB.

| Bucket | First-load JS (gz) | vs 200 KB budget |
|--------|--------------------|------------------|
| Shared floor | 136 kB | ✅ |
| `/`, `/pricing`, `/admin/*`, `/_not-found`, light auth | 137–158 kB | ✅ |
| `/projects` 213 · `/dashboard` 220 · `/login` 224 · `/signup` 224 · `/settings/billing` 233 · `/team` 235 | 213–235 kB | ⚠️ 13–35 KB over |

- Residual overage on authenticated/auth pages is the **Supabase browser client + Sentry core** floor. Getting strictly under 200 KB everywhere would need lazy-loading the Sentry client (loses early client-error capture) — **deferred to v2 / a decision**, not blocking deploy.
- ✅ `RevenueChart`/recharts is isolated to its own lazy chunk (not in first-load). ✅ No client Stripe.js (server-redirect checkout).

### Env vars — clean
Every var the code reads via `process.env` is documented in `.env.example`. Two notes captured above (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unused, `SENTRY_DSN` hardcoded).

### Tap targets — primary controls fixed
shadcn "nova" preset shipped `Button` default at `h-8` (32px). Bumped the **primary** size variants (`default` → 44px, `lg` → 48px, `icon`/`icon-lg` → 44px) in `components/ui/button.tsx`; left `xs`/`sm`/`icon-xs`/`icon-sm` compact (explicitly opted into for dense admin tables). **Visual result needs confirmation in the live pass** (taller/wider primary buttons).

### Still for the live pass
Lighthouse scores, screen-reader pass, contrast spot-checks in dark mode, real-phone verification of the new button sizes, and everything in §1–6 above.
