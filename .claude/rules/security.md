# Security rules

These rules treat security as a property of the codebase, not a checklist done before launch.

---

## Authorization verification

**Automated tests are necessary but not sufficient.** Before every phase is marked complete:

1. Run the two-account RLS test from `.claude/setup.md` section 12.
2. For any new table or new RLS policy added in this phase, repeat the test against that table.
3. For any new admin route, log in as a non-admin and attempt the route directly — confirm 403.
4. Record the verification in `PROGRESS.md` with the phrase: `RLS verified for tables: <list>`.

A phase ships only after this manual verification. No exceptions.

---

## Input validation

- **Every API route handler and every Server Action validates with Zod** before any DB call, Stripe call, or external API call.
- Schemas live in `lib/validation/<domain>.ts`. Reuse — don't duplicate per route.
- **Server-side validation is mandatory even when the client also validates.** Client validation is UX; server validation is the security control.
- Validation failures return:
  ```ts
  { ok: false, error: { error: "Invalid input", code: "VALIDATION_ERROR", fieldErrors: { name: "Required", ... } } }
  ```
- Webhook payloads are signature-verified first, then Zod-parsed against a per-event schema. Unknown event types are ignored (return 200) — they're not errors.

---

## Rate limiting

Every of the following gets a rate limiter:

| Surface | Limit | Bucket key |
|---------|-------|------------|
| Login form | 10 / 15 min | IP + email |
| Signup form | 10 / 15 min | IP |
| Password reset request | 5 / hour | email |
| Magic link request | 5 / hour | email |
| `/api/billing/checkout` | 10 / min | user.id |
| `/api/billing/portal` | 10 / min | user.id |
| `/api/billing/cancel` | 5 / min | user.id |
| `/api/team/invite` | 10 / hour | workspace.id |
| `/api/team/accept` | 10 / min | IP |
| `/api/team/remove` | 10 / min | workspace.id |
| `/api/admin/*` (write) | 30 / min | admin.id |
| Stripe webhook | 100 / 10s | IP (Stripe's IPs are stable) |

Implementation pattern (`lib/ratelimit.ts`):

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

export const limiters = {
  login:           new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:login" }),
  signup:          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "15 m"), prefix: "rl:signup" }),
  passwordReset:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 h"),  prefix: "rl:pwreset" }),
  magicLink:       new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 h"),  prefix: "rl:magic" }),
  billingCheckout: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),  prefix: "rl:bill:co" }),
  billingPortal:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),  prefix: "rl:bill:po" }),
  billingCancel:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  "1 m"),  prefix: "rl:bill:cn" }),
  teamInvite:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"),  prefix: "rl:team:in" }),
  teamAccept:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),  prefix: "rl:team:ac" }),
  teamRemove:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"),  prefix: "rl:team:rm" }),
  adminWrite:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"),  prefix: "rl:adm:wr" }),
  webhookStripe:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100,"10 s"), prefix: "rl:wh:st" }),
} as const

export async function checkRateLimit(
  limiter: keyof typeof limiters,
  identifier: string,
): Promise<{ success: true } | { success: false; error: ApiError }> {
  const { success, limit, remaining, reset } = await limiters[limiter].limit(identifier)
  if (success) return { success: true }
  return {
    success: false,
    error: {
      error: `Too many requests. Try again at ${new Date(reset).toLocaleTimeString()}.`,
      code: "RATE_LIMITED",
    },
  }
}
```

Use at the top of every applicable handler:
```ts
const rl = await checkRateLimit("billingCheckout", user.id)
if (!rl.success) return Response.json(rl.error, { status: 429 })
```

---

## Content sanitization

Workspace names, project names, and member display names go into emails. **All interpolation in email templates is React-escaped by default** (React Email components escape children). If you ever use `dangerouslySetInnerHTML` (don't), wrap input in `DOMPurify.sanitize(input)` first.

For the impersonation banner (admin) which displays a workspace/user name — React JSX escapes. No raw HTML, no markdown rendering, no XSS surface in v1.

---

## Sensitive operations

| Operation | Where it runs | Auth |
|-----------|---------------|------|
| `supabase.auth.admin.*` (delete user, list users) | Route handlers only | `requireAdmin()` + service role client |
| `supabase.from("subscriptions").upsert(...)` | Webhook handler + Server Actions only | service role client (RLS would block) |
| `supabase.from("activity_log").insert(...)` | Server-side only | service role |
| `stripe.subscriptions.cancel(...)` | `/api/billing/cancel` only | `requireAuth()` + workspace ownership check |
| Set/clear impersonation cookie | `/api/admin/users/[id]/impersonate` only | `requireAdmin()` |
| Read `SUPABASE_SERVICE_ROLE_KEY` | Server only | `process.env` — undefined in browser |

**The service role client lives in `lib/supabase/server.ts` and is gated behind a function that may only be called from a route handler or a Server Action.** Importing it into a Server Component is forbidden by convention (and reviewed for in PR).

---

## Auth security

- **Never leak whether an email is registered.** "Wrong email or password" — never "user not found." Same delay on hit and miss (the rate limiter handles timing; don't add artificial delays).
- **Password reset:** generic success message regardless of whether the email exists. The link is only sent if the account exists.
- **Reset link expiry:** 1 hour, single-use (Supabase handles this — don't override).
- **OAuth + password same email merge:** Supabase merges into a single `auth.users` row when the email matches and is verified. Test: sign up with email/password, verify, then "Continue with Google" using the same email — should land on the same workspace, not a new one.
- **JWT in cookies:** httpOnly + SameSite=Lax + Secure. The Supabase SSR helpers set these correctly — do not override.
- **Email verification:** required before access to the app. Unverified users land on `/verify-email`.
- **Magic links:** single-use, 1-hour expiry. Same UX rule: don't reveal whether the address is registered.

---

## Dependency security

- **Audit before adding.** Run `npm audit` before each install. Skip the install if there's a known critical vuln.
- **Pin majors.** `package.json` uses `^x.y.z` (default) — but `package-lock.json` is committed, so installs are reproducible.
- **`npm audit` in CI** (warn-only). Critical-severity issues fail the build.
- **Renovate / Dependabot** for monthly bumps — not in v1 scope but worth enabling post-launch.

---

## Secret management

- **`.env.local`** is the only file with real values, and it is gitignored.
- **`.env.example`** is committed — it's the contract for required env vars, with placeholder values.
- **Vercel environment variables** for every non-local environment. Use Vercel's per-environment scoping (Production / Preview / Development).
- **Never log secrets.** Never put a secret in a `Sentry.captureException` extra, never `console.log(process.env.STRIPE_SECRET_KEY)`.
- **Rotate** if a secret is exposed: Stripe (regenerate secret key + rotate webhook secret), Supabase (regenerate service-role + anon keys, update both), Resend (regenerate API key), Upstash (regenerate token).
- **Pre-commit hook (optional but recommended):** `husky` + `lint-staged` running `git secrets --pre_commit_hook` to block accidental commits of `sk_`, `whsec_`, `re_`, etc.
- **`SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` are never in `NEXT_PUBLIC_*` vars.** Anything `NEXT_PUBLIC_*` is shipped to the browser bundle.
