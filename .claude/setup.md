# Pre-build setup

Every step that has to happen before the first line of application code is written. Written for someone who has never seen this project. Do not skip the verification checklist at the bottom — it is the only thing that prevents silent misconfiguration.

---

## 1. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 20.11 LTS | `node -v` |
| npm | ≥ 10 | `npm -v` |
| Git | ≥ 2.40 | `git --version` |
| Stripe CLI | ≥ 1.21 | `stripe --version` |
| Supabase CLI | ≥ 1.180 (optional, for local DB) | `supabase --version` |
| Vercel CLI | ≥ 39 (optional, for `vercel env pull`) | `vercel --version` |

Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe   # macOS
# https://docs.stripe.com/stripe-cli for other OS
stripe login
```

Install Supabase CLI:
```bash
brew install supabase/tap/supabase
supabase --version
```

---

## 2. Project scaffold

```bash
cd ~/Documents/aiprojects
# directory already exists; ensure inside it
cd basekit

# only run create-next-app if app/ does not yet exist
npx create-next-app@latest . \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*" \
  --eslint --no-turbopack
```

Install runtime dependencies:
```bash
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
```

Install dev dependencies:
```bash
npm install -D \
  vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom \
  @types/node
```

Initialise shadcn/ui:
```bash
npx shadcn@latest init    # neutral base, CSS variables: yes, RSC: yes
npx shadcn@latest add \
  button badge input textarea label \
  dialog dropdown-menu separator \
  avatar skeleton tabs popover tooltip \
  select switch table form sheet alert
```

---

## 3. Supabase setup

### 3a. Create the project
1. Go to <https://supabase.com> → Dashboard → New project.
2. Name: `basekit-dev`. Region: closest to you. Generate a strong DB password — store it in 1Password.
3. Wait for provisioning (~2 minutes).

### 3b. Capture credentials
From Project Settings → API:
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never commit, never expose to client)

### 3c. Run migrations
Open Project → SQL Editor → paste and run each migration from `supabase/migrations/` in numeric order. (Phase 1 of the build creates these.) Until those exist, the only thing you do here is verify the project is up.

### 3d. Enable storage bucket
Storage → New bucket → name `avatars` → **public**, MIME types `image/png, image/jpeg, image/webp`, file size limit 2 MB.

Add storage policies (Storage → Policies → New policy on `avatars`):
- `avatars_select_public` — `SELECT` — condition `true`
- `avatars_insert_own_folder` — `INSERT` — condition `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text`
- `avatars_update_own_folder` — `UPDATE` — condition same as insert
- `avatars_delete_own_folder` — `DELETE` — condition same as insert

### 3e. Redirect URLs
Project → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/**`

### 3f. Auth providers
Authentication → Providers:
- **Email:** enabled, "Confirm email" on.
- **Google:** enabled. You'll need a Google Cloud OAuth client — see step 5.
- **Magic link:** enabled (uses the email provider).

---

## 4. Stripe setup

### 4a. Create the account
1. Sign up at <https://stripe.com>. Use test mode for development.
2. From Developers → API keys: copy **Publishable key** (`pk_test_...`) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`.

### 4b. Create products and prices
Products → Add product:

| Product | Price (monthly) | Price (annual) |
|---------|-----------------|----------------|
| basekit Pro | $29 USD recurring monthly | $276 USD recurring annual ($23/mo) |
| basekit Enterprise | $99 USD recurring monthly | $948 USD recurring annual ($79/mo) |

After creating each price, copy its `price_...` ID:
- Pro monthly → `STRIPE_PRICE_PRO_MONTHLY`
- Pro annual → `STRIPE_PRICE_PRO_ANNUAL`
- Enterprise monthly → `STRIPE_PRICE_ENTERPRISE_MONTHLY`
- Enterprise annual → `STRIPE_PRICE_ENTERPRISE_ANNUAL`

### 4c. Configure Customer Portal
Settings → Billing → Customer portal:
- **Functionality:** allow customers to cancel, switch plans (between Pro and Enterprise), update payment method, view invoices.
- **Cancellation:** at end of billing period.
- **Plan changes:** allow upgrade/downgrade between basekit Pro and basekit Enterprise.
- **Business information:** add your company name + Privacy / ToS URLs (placeholder OK for dev).

### 4d. Webhook endpoint
Developers → Webhooks → Add endpoint:
- **Endpoint URL:** `http://localhost:3000/api/webhooks/stripe` (will replace with prod URL on deploy)
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- After creating: reveal **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

For local development, instead use the Stripe CLI which gives you a dynamic signing secret:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the "Your webhook signing secret is whsec_..." line into STRIPE_WEBHOOK_SECRET
```

---

## 5. Google OAuth

1. <https://console.cloud.google.com> → new project `basekit-dev`.
2. APIs & Services → OAuth consent screen → External → fill app name, support email, dev email. Add scopes: `email`, `profile`, `openid`.
3. APIs & Services → Credentials → Create OAuth client ID → Web application:
   - **Authorised JavaScript origins:** `http://localhost:3000`
   - **Authorised redirect URIs:** copy the redirect URL from Supabase Auth → Providers → Google (format: `https://<project>.supabase.co/auth/v1/callback`)
4. Copy the **client ID** and **client secret** into Supabase Auth → Providers → Google → save.

---

## 6. Resend

1. <https://resend.com> → sign up.
2. Add a domain (or use the sandbox `onboarding@resend.dev` for early development — note this only sends to your own verified email).
3. API Keys → create → copy → `RESEND_API_KEY`.
4. Set `FROM_EMAIL` (e.g. `hello@basekit.dev` for prod, your own email for dev sandbox).

---

## 7. Upstash Redis

1. <https://upstash.com> → sign up.
2. Redis → Create Database → name `basekit-ratelimit-dev` → region matching your Vercel deploy → free tier.
3. From the database overview, copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**.

---

## 8. Sentry

1. <https://sentry.io> → new project → Next.js platform → name `basekit`.
2. Copy the DSN → `SENTRY_DSN`.
3. Sentry org settings → Auth Tokens → create a token with `project:write` → `SENTRY_AUTH_TOKEN` (used by source-map upload in CI).

---

## 9. Environment variables

Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```

Fill in every value from the steps above.

| Var | Source | What breaks if wrong |
|-----|--------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | All Supabase calls fail |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings | Auth + RLS-bound reads fail |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings | Webhook handler can't write; signup bootstrap fails |
| `STRIPE_SECRET_KEY` | Stripe API keys | All Stripe SDK calls fail |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys | Stripe.js can't load on client |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` or webhook endpoint | Every webhook returns 400 (signature invalid) |
| `STRIPE_PRICE_PRO_MONTHLY` etc. | Stripe price IDs | Checkout button creates session with wrong/no price |
| `RESEND_API_KEY` | Resend dashboard | Every email send fails (non-fatal but no emails sent) |
| `FROM_EMAIL` | your verified Resend sender | Emails rejected by Resend |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash | Rate limiter throws on every request |
| `SENTRY_DSN` | Sentry project | No error tracking (silently swallows errors) |
| `SENTRY_AUTH_TOKEN` | Sentry auth tokens | CI source-map upload fails (warns, doesn't break deploy) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` (dev) | OAuth redirect + email links go to wrong host |

---

## 10. Seed data

For local dev, create one admin account by hand:
1. Sign up via the UI with your real email.
2. In Supabase SQL Editor:
   ```sql
   update profiles set role = 'admin' where id = '<your auth.users id>';
   ```
3. Reload — you should see `/admin` accessible.

For repeated local tests, create at least two non-admin accounts to test workspace isolation.

---

## 11. Verification checklist

Run these before writing application code. Every check must pass.

### 11a. Supabase
```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# expect: 200 with a small JSON body listing endpoints
```

### 11b. Stripe
```bash
stripe products list --limit 3
# expect: your two products (Pro, Enterprise) listed
```

### 11c. Resend
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"$FROM_EMAIL\",\"to\":\"$FROM_EMAIL\",\"subject\":\"basekit setup ping\",\"text\":\"working\"}"
# expect: { "id": "..." } and an email arrives in your inbox
```

### 11d. Upstash
```bash
curl "$UPSTASH_REDIS_REST_URL/get/setup-check" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
# expect: { "result": null } — connection works, key doesn't exist yet
```

### 11e. Sentry
```bash
# Wait until after sentry is wired in the app — then visit a route that triggers a test error
# Sentry → Issues should show the test event within 30s
```

### 11f. Stripe webhook forwarding
```bash
# In one terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# In another:
stripe trigger checkout.session.completed
# expect: terminal shows "200" delivery
```

---

## 12. RLS verification (manual, required — automated tests are NOT sufficient)

This is the single test that prevents data leaks. Do it after the schema and auth flow exist, before declaring Phase 1 complete.

1. Open the app in two different browsers (or one normal + one incognito).
2. Sign up as `userA@test.com` in Browser A. A workspace is created for A.
3. Sign up as `userB@test.com` in Browser B. A workspace is created for B.
4. In Browser A, create a project named "A's project".
5. In Browser B, navigate to `/projects`.
6. **Expected:** Browser B sees an empty list. If Browser B sees "A's project", RLS is broken — do not proceed.
7. In Browser A, open DevTools → Network → reload `/projects`. Right-click the Supabase response → "Copy as cURL" — paste into Browser B's DevTools console as `fetch(...)`. **Expected:** the request returns 401 or 403 (Browser A's JWT is rejected because Browser B's cookies/headers don't match). If it returns A's project rows, RLS is broken.
8. In Browser B, attempt to query `subscriptions` directly via DevTools:
   ```js
   await fetch('<NEXT_PUBLIC_SUPABASE_URL>/rest/v1/subscriptions?workspace_id=eq.<A workspace id>', {
     headers: { apikey: '<NEXT_PUBLIC_SUPABASE_ANON_KEY>', authorization: 'Bearer ' + supabaseSession.access_token }
   }).then(r => r.json())
   ```
   **Expected:** empty array. If B sees A's subscription row, RLS is broken.
9. Sign B out. Re-attempt step 8 with no Authorization header. **Expected:** empty array (anon role has no read policy).

If any step shows the wrong result, the RLS policy on that table is wrong. Fix the policy, redeploy, repeat from step 1.

---

## 13. Local dev startup (every session)

```bash
# terminal 1
npm run dev

# terminal 2 — Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# terminal 3 — React Email preview (optional)
npm run email
```
