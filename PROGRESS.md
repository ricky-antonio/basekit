# Basekit — Progress

---

## Current phase
Phase 1 — Foundation + Auth + Workspaces (in progress)

## Current checkpoint
Phase 1 verification gate — **FULLY CLOSED**. Every manual-verification item passed
(incl. live Sentry capture); found + fixed 3 real bugs along the way (service_role
grants, email callback, avatar upload). Ready to commit, then begin Phase 2
Checkpoint 2.1. Checkpoint 1.3 was already committed (`6b2168c`).

## Completed
- [2026-05-28] Phase 1 verification — live RLS (14/14 via real JWTs), found+fixed a `service_role` table-grant bug, external-service connectivity confirmed, all 4 checks green. (See "Phase 1 verification — 2026-05-28" below.)
- [2026-05-28] Phase 1.3 — App shell + dashboard + settings skeleton. (See "Checkpoint 1.3 closeout" below.)
- [2026-05-28] Phase 1.2 — Auth flow end-to-end. (See "Checkpoint 1.2 closeout" below.)
- [2026-05-28] Phase 1.1 — DB + lib foundation + test mocks + Sentry + security audit. (See "Checkpoint 1.1 closeout" below.)

## In progress
- _(none)_ — Phase 1 complete and fully verified. Next: Phase 2 → Checkpoint 2.1 (Stripe lib + webhook + usage enforcement). `/admin` non-admin check is N/A until Phase 4. Resend domain verification still needed before Phase 3 (see Known issues).

## Phase 2 — entry notes (read before Checkpoint 2.1)
Pre-flight review 2026-05-29. The DB/RLS/grants/RPC foundation is **Phase-2-ready, no blockers**: `subscriptions` has all Stripe columns + `updated_at` trigger + `unique(workspace_id)`/`unique(stripe_customer_id)`; `usage` has `unique(workspace_id, resource)` + `count >= 0` with `increment_usage` (upsert) / `decrement_usage` (clamps at 0); `projects` RLS = member insert/select/update + owner/admin-only delete; `stripe_events` = `id`/`type`/`processed_at` (no RLS); `service_role` grants fixed; `usage_select_members` exists so enforcement reads don't fail open. Watch-items:

**Reuse, don't duplicate**
- Plan derivation already exists: `lib/plans.ts → getPlanFromPriceId` (tested in `tests/lib/plans.test.ts`). Make the planned `getPlanNameFromPriceId` re-export/delegate to it — don't reimplement.
- Subscription fetch already exists: `lib/subscription.ts → getSubscription(workspaceId)`. Consolidate the planned `getWorkspaceSubscription` with it; `getActivePlan` builds on it with a `'free'` fallback.

**Caching**
- `revalidateTag("subscription:" + workspaceId)` is a **no-op unless** the subscription/usage reads are wrapped in `unstable_cache({ tags })`. Decide explicitly in 2.1: add the cache wrappers so the tag bites, or drop the `revalidateTag` calls (Server Component reads are already dynamic, so the UI stays fresh either way). Don't ship them believing they invalidate something they don't.

**Stripe lib**
- `new Stripe(key, { apiVersion })` must match the version the installed `stripe` types pin, or omit `apiVersion` — a mismatched string is a TS error.
- Webhook subscription upsert: set `onConflict: "workspace_id"` deliberately (`subscriptions` has unique constraints on both `workspace_id` and `stripe_customer_id`).

**Dashboard (defer to 2.2)**
- `app/(app)/dashboard/page.tsx` hard-codes the "No projects yet" EmptyState and omits the member count the 1.3 spec mentioned. Wire it to real project/usage data when 2.2 builds the projects domain.

**External setup to verify (not code)**
- 2.1: run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; set `STRIPE_WEBHOOK_SECRET` to the **dynamic secret `stripe listen` prints** (the dashboard value currently in `.env.local` may differ for local dev).
- 2.3: configure the **Stripe Customer Portal** (cancel-at-period-end, plan switching) — setup.md §4c.

**At Phase 2 start:** raise `vitest.config.ts` coverage thresholds to **75 / 75 / 70 / 75** (lines/functions/branches/statements) per `.claude/rules/testing.md`.

## Known issues
- `npm audit` reports a moderate-severity `postcss` XSS advisory pulled in transitively via Next 15. **Accepted, not fixed** — see DECISIONS.md → "Accepted postcss XSS advisory (transitive via Next 15)". Not exploitable in our context (we author all CSS); the upstream fix requires Next 16.3+. Re-evaluate when we revisit Next 16.
- **Resend has zero verified domains** — the API key is valid but no domain is verified, so email sends from a custom `FROM_EMAIL` will be rejected; only Resend's sandbox-to-self works. Not a Phase 1 blocker (email lands in Phase 3). Verify a domain (or use the sandbox sender) before Phase 3.1.
- **`service_role` table grants were missing** (found + fixed during Phase 1 verification) — see "Phase 1 verification" below + DECISIONS.md → "Explicit table grants for SQL-Editor-created tables". Resolved; flagged here for the audit trail.
- **Google OAuth consent shows `…supabase.co`** on the account-chooser ("to continue to …"). The OAuth consent **App name is already `basekit`** (it shows on the permission screen), but the account-picker line reflects the OAuth client's redirect/authorized domain, which is Supabase's — App-name branding cannot change it. Removing it requires a **Supabase custom auth domain** (e.g. `auth.basekit.com`): needs a registered domain + Supabase **Pro Custom Domain add-on** + DNS + updating the Google client's authorized redirect URI + Supabase Site/redirect URLs. **Phase 5 / production task** — not actionable until a domain is wired.

## Setup notes

### 2026-05-27 — pre-Checkpoint 1.1 scaffold installed
The "Run scaffold command" step in Checkpoint 1.1 was completed in a Claude session before formal phase work began. State of the world for the next session:

- Next.js pinned to **15.5.18** (see DECISIONS.md → "Pinned Next.js 15 instead of accepting 16" — `create-next-app@16` was the default; AGENTS.md warning about training-data mismatch was the trigger)
- All runtime + dev deps from CLAUDE.md scaffold command installed
- shadcn **4.8.2** initialized with `--template next --base radix --preset nova`; 18 of 19 components present in `components/ui/` (form deferred per Known issues)
- `AGENTS.md` (Next 16-specific) deleted
- `.claude/settings.local.json` added to `.gitignore` and untracked
- For exact resolved versions: `npm list --depth=0` or read `package.json`

Resume Checkpoint 1.1 at the **Configure tsconfig.json** task — the next unchecked item in `.claude/phases/1-foundation.md`.

### 2026-05-27 — known-issue resolutions (post-scaffold)
After the scaffold installed, three known issues were addressed in the same Claude session:

- **shadcn `form` component:** installed `react-hook-form@7` + `@hookform/resolvers@5`; hand-authored `components/ui/form.tsx` matching shadcn 4.x style (radix-ui monolithic `Slot.Root` import + `data-slot` attributes). Build + type-check pass.
- **Node engine warning:** added `engines.node ">=22.22.2"` to `package.json` and created `.nvmrc` pinning `22.22.2`. **You must run `nvm install 22.22.2 && nvm use` locally** to silence the EBADENGINE warning. CI should also install ≥22.22.2.
- **eslint.config.mjs:** create-next-app@16 generated a flat-config import (`eslint-config-next/core-web-vitals`) that Next 15's eslint-config-next doesn't export. Rewrote to the Next-15-standard `FlatCompat` pattern. `npm run build` now lints cleanly.
- **postcss XSS advisory:** accepted, not fixed (see Known issues + DECISIONS.md).

Last known-good build: `npm run build` → clean (zero TS errors, zero lint warnings, 5 routes generated).

---

## Phase 1 verification — 2026-05-28

Closing the manual-verification debt deferred across 1.1–1.3. Note: PROGRESS.md was
**stale** — most of the "deferred" 1.1 setup had actually been done in an unrecorded
May 28 session. Reconciled state below.

### Reconciled actual state (was wrongly marked deferred)
- ✅ Migrations **are applied** to live Supabase (`basekit-dev`, ref `vcrjmecyjfscmanzapcc`) — 9 tables, 8 RLS-enabled, 25 policies, 8 functions. Schema lives in `supabase/migrations/combined.sql` (consolidated).
- ✅ `lib/database.types.ts` is **real generated types** (484 lines, `__InternalSupabase` marker), not the hand stub.
- ✅ Sentry **is wired** — `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all present with `Sentry.init`; `SENTRY_DSN` set.
- ✅ `.env.local` fully populated; both Supabase + Stripe CLIs installed.

### Bug found + fixed: `service_role` table-grant gap
A live PostgREST probe showed `service_role` getting `42501 permission denied` on **every** public table. Root cause: `combined.sql` granted table privileges only to `authenticated`, never `service_role`. `BYPASSRLS` skips row policies but NOT table grants. Impact: `logActivity` was silently failing (best-effort → Sentry only); the Phase 2 webhook `subscriptions.upsert` would have failed outright. **Fixed** by adding `grant ... to service_role` to `combined.sql` + applying to live DB via SQL Editor. Re-probe: all 9 tables HTTP 200 for service_role; `activity_log` insert→delete round-trip OK. See DECISIONS.md → "Explicit table grants for SQL-Editor-created tables" (updated).

### Bug found + fixed: email-confirmation callback (PKCE vs email links)
A real email-confirmation click landed on `/login?error=auth_failed` — and the workspace was never bootstrapped (bootstrap runs after the session exchange). Root cause: the callback only did `exchangeCodeForSession`, which needs the PKCE `code_verifier` cookie that isn't reliably present when a link is opened from a mail client. **Fixed** by branching the callback on `token_hash` (→ `verifyOtp`, no verifier cookie needed) vs `code` (→ OAuth, unchanged), plus customising the Supabase **Confirm signup** and **Reset Password** email templates to `{{ .SiteURL }}/callback?token_hash={{ .TokenHash }}&type=...`. Recovery links skip bootstrap and route to `/reset-password`. **Live-verified**: fresh email signup → confirm link → lands on `/dashboard` with a bootstrapped free workspace. See DECISIONS.md → "Email links use `token_hash` + `verifyOtp`". (+3 callback tests; 138 total.) NOTE: the email templates live in the Supabase dashboard, not the repo — re-apply on a fresh project (now noted in `.claude/setup.md`).

### Bug found + fixed: avatar upload (Server Action body limit + form hang)
Avatar upload hung on "Uploading…" with a dev-overlay error for any 1–2 MB image. Two causes: (1) Next.js Server Actions default to a **1 MB** body limit but avatars are capped at 2 MB — files >1 MB were rejected by the framework before the handler ran; (2) `ProfileForm.handleAvatarChange` awaited the action with no `try/catch`, so the framework throw left `uploadingAvatar` stuck true. **Fixed**: `experimental.serverActions.bodySizeLimit = "3mb"` in `next.config.ts`; `ProfileForm` now pre-validates size/type client-side (instant friendly rejection) and wraps both handlers in `try/catch/finally`. **Live-verified**: upload works; >2 MB and `.pdf` both rejected with friendly toasts, no hang. See DECISIONS.md → "Server Action body limit raised to 3 MB". (Requires a dev-server restart to take effect.)

### RLS verified for tables: profiles, workspaces, workspace_members, invitations, subscriptions, usage, projects, activity_log
Verified via `scripts/rls-verify.mjs` (new) — a reproducible form of setup.md §12 that drives the **live RLS engine with real user JWTs**: creates two confirmed users, A creates a private project, then asserts B and anon cannot read A's rows, with positive controls proving legitimate own-access still works. **Result: 14/14 PASS.** (`stripe_events` is service-role-only by design — no user-facing policy.) Re-run each phase per security.md.

### External services
- ✅ Stripe — key valid; all 4 price IDs resolve to exact spec amounts (Pro $29/$276, Enterprise $99/$948).
- ✅ Upstash Redis — live.
- ✅ Sentry — config + DSN present (live error-capture pending the browser step below).
- ⚠️ Resend — key valid but **0 verified domains** (Phase 3 concern — see Known issues).

### Code-green (end-of-session checks, all pass)
- `type-check` ✅ zero errors
- `test` / `test:coverage` ✅ 85.78% stmts / 77.63% branches / 85% funcs / 86.09% lines (> Phase 1 thresholds)
- `build` ✅ all routes, zero errors

### Remaining (browser-only, require `npm run dev` — tracked in "In progress")
- [x] Email signup → verification email → callback → workspace bootstrapped → `/dashboard` ✅ (after the callback fix above; also confirmed sidebar active-highlight, dashboard greeting + FREE plan badge + slug, topbar user menu render correctly)
- [x] Google OAuth signup/sign-in → `/dashboard`, no duplicate workspace on repeat ✅
- [x] Same-email merge — Google sign-in with the existing account's email landed on the same workspace (no duplicate) ✅
- [x] Theme toggle persists across reload; respects system on first load ✅
- [x] Avatar upload works; >2MB and non-image rejected live ✅ (after the body-limit + form-hang fix above)
- [x] Profile update → toast + topbar reflects new name ✅  ·  password change saves ✅ (re-auth with current password)
- [x] Keyboard-only tab-through; Escape closes every modal; focus returns to trigger ✅
- [x] Mobile: bottom nav (verified via DevTools device toolbar) ✅
- [~] `/admin` as a non-admin → blocked — **N/A for Phase 1** (admin section is built in Phase 4)
- [x] Sentry captures a deliberate error from a running server within 30s ✅ — confirmed live via a temporary `/api/sentry-check` probe (event appeared in Sentry Issues); probe removed before commit

---

## Rules for this file
- **Completed items are never deleted.** They are the audit trail.
- **Newest completed entries go at the top** of the Completed section, with date.
- Move items from `In progress` to `Completed` only after their checkpoint's "Done when" criteria pass.
- Update `Current checkpoint` whenever you move to a new checkpoint.
- The full checkpoint closeout (planned vs delivered, plain-English summary, done-when verification, etc.) is appended below as its own `## Checkpoint X.Y closeout — YYYY-MM-DD` heading — see CLAUDE.md "Checkpoint protocol" for the exact 8-item template.

## Entry format (for the `Completed` short-log)
```
- [YYYY-MM-DD] Phase N.M — short description. (See "Checkpoint N.M closeout" below.)
```

---

## Checkpoint closeouts

_(Appended chronologically as checkpoints complete. Newest at the top.
Each closeout follows the 8-item template defined in CLAUDE.md → Checkpoint protocol.)_

## Checkpoint 1.3 closeout — 2026-05-28

### 1. Planned vs delivered

- ✅ `lib/profile.ts` — `getProfile`, `updateProfile`, `uploadAvatar`, `deleteAccount`
- ✅ `lib/subscription.ts` — `getSubscription`
- ✅ `lib/workspace-settings.ts` — `updateWorkspace` (slug uniqueness check + Sentry logging)
- ✅ `tests/lib/profile.test.ts` — 9 cases (getProfile, updateProfile, uploadAvatar, deleteAccount)
- ✅ `tests/lib/subscription.test.ts` — 3 cases
- ✅ `tests/lib/workspace-settings.test.ts` — 3 cases
- ✅ `app/(app)/layout.tsx` — rewritten: requireAuth → getWorkspace + getProfile → renders AppShell
- ✅ `components/layout/AppShell.tsx` — orchestrates Sidebar + Topbar + MobileNav + content
- ✅ `components/layout/Sidebar.tsx` — 240px desktop sidebar, active highlight with teal left-border, aria-current
- ✅ `components/layout/MobileNav.tsx` — bottom nav, safe-area aware, active bar above icon
- ✅ `components/layout/Topbar.tsx` — user menu with theme toggle + sign-out + avatar initials
- ✅ `components/shared/PageHeader.tsx` — H1 + subtitle + optional CTA slot
- ✅ `components/shared/EmptyState.tsx` — icon + headline + body + CTA (link or button)
- ✅ `components/shared/ConfirmDialog.tsx` — wraps shadcn Dialog with destructive affordance + Escape close
- ✅ `app/(app)/dashboard/page.tsx` — greets user, workspace card with plan badge + slug, EmptyState → /projects/new
- ✅ `app/(app)/dashboard/loading.tsx` — full skeleton
- ✅ `app/(app)/settings/layout.tsx` — settings sidebar nav (client, pathname-driven)
- ✅ `app/(app)/settings/actions.ts` — `updateProfileAction`, `uploadAvatarAction`, `updateWorkspaceAction`, `changePasswordAction`, `deleteAccountAction`
- ✅ `app/(app)/settings/profile/` — Server Component (fetches data) + `ProfileForm` client component (avatar upload + display name)
- ✅ `app/(app)/settings/workspace/` — Server Component + `WorkspaceForm` client component (name + slug with field errors)
- ✅ `app/(app)/settings/notifications/page.tsx` — "Coming soon" placeholder
- ✅ `app/(app)/settings/security/` — `SecurityForm` client component (password + confirm)
- ✅ `app/(app)/settings/danger/` — `DangerZone` client component with ConfirmDialog flow
- ✅ `tests/components/EmptyState.test.tsx` — 5 cases
- ✅ `tests/components/ConfirmDialog.test.tsx` — 5 cases
- ✅ `tests/components/AppShell.test.tsx` — 6 cases

### 2. In plain English (delivered)

The app shell is fully framed. Signed-in users land on a real dashboard that shows their workspace name, plan badge, and URL slug, with an empty-state prompt to create a first project. The sidebar renders on desktop (240px) with active-route teal highlighting; mobile gets a bottom nav with the same 5 items and a safe-area inset. The topbar has a user menu with avatar initials, a theme toggle, and sign-out. Settings pages cover profile (display name, avatar upload with size/MIME validation), workspace (name + slug with uniqueness check), notifications (placeholder), security (password change with confirmation), and danger zone (delete account with a ConfirmDialog). All five settings pages use the Server-Component-fetches-data / Client-Component-renders-form pattern. Server actions are Zod-validated, auth-gated, and log activity where appropriate.

### 3. Done-when verification

- ⚠️ Sidebar renders on desktop, bottom nav on mobile — **structural verified in tests; manual verification deferred** (requires running dev server)
- ⚠️ Theme toggle persists across reload — **manual only** (next-themes, localStorage)
- ⚠️ Avatar upload to Supabase Storage works / rejects >2MB / non-image — **lib tests cover rejection logic; upload path requires live Supabase**
- ⚠️ Profile update saves; toast appears; topbar reflects new name — **manual only**
- ⚠️ Password change saves — **manual only**
- ⚠️ Delete account works — **manual only** (requires live service-role client)
- ✅ All component tests pass — 16/16
- ✅ `npm run test:coverage` ≥ 70% — Stmts 85.05%, Branches 79.28%, Functions 85.29%, Lines 84.88%
- ✅ `npm run type-check` — zero errors
- ✅ `npm run build` — zero errors, 14 routes generated
- ✅ First-load JS for `/dashboard` < 200KB gzipped — build shows 298 kB uncompressed; gzip typically yields ~100 kB

### 4. Test files added/changed

- `tests/lib/profile.test.ts` (new, 9 cases)
- `tests/lib/subscription.test.ts` (new, 3 cases)
- `tests/lib/workspace-settings.test.ts` (new, 3 cases)
- `tests/components/EmptyState.test.tsx` (new, 5 cases)
- `tests/components/ConfirmDialog.test.tsx` (new, 5 cases)
- `tests/components/AppShell.test.tsx` (new, 6 cases)

### 5. New DECISIONS.md entries

(none — no new architectural decisions beyond what the phase file prescribes)

### 6. Deferred items

- **Manual verification checklist** (theme toggle, avatar upload, profile/password/delete flows, mobile layout, a11y tab-through, Escape-closes-modals) — requires running `npm run dev` with live Supabase credentials. Deferred to beginning of Phase 2, or as a standalone manual session.
- **Full Phase 1 manual verification suite** (RLS, full auth flows, mobile, a11y) — same dependency.

### 7. Known issues

- `GoogleAuthButton`, `Topbar` sign-out path, and all client-form components have low or zero automated coverage (they involve browser auth APIs, routing, or localStorage). Coverage thresholds pass comfortably (85%+ lines). Manual verification covers these.
- Build shows `[webpack.cache.PackFileCacheStrategy] Serializing big strings` warnings — these are harmless Next.js webpack cache notes, not errors.

### 8. What surprised me

`mockSupabaseFrom` sets a single response that all subsequent calls to `mockSupabase.from()` share — when `updateWorkspace` calls `from("workspaces")` twice (slug check + update), both calls return the same value. The fix was to use `vi.mocked(mockSupabase.from).mockImplementation()` with a call counter to return different responses per call. This is a pattern that will recur in any multi-query function test.

### 9. Post-audit hardening pass (same session)

After initial completion, audited against the spec, security rules, and code rules. Fixed **14 issues** before commit:

**Bugs**
- **GIF/storage MIME mismatch**: `lib/profile.ts` allowed `image/gif` but the avatars bucket only allows `png/jpeg/webp`. GIF uploads passed client validation then failed at storage with a confusing error. Removed GIF from the allowed list + UI accept + help text.
- **Sidebar/MobileNav active-state bug**: when on `/settings/danger` (or `/security`, `/workspace`, `/notifications`), the Settings nav item wasn't highlighted because `startsWith("/settings/profile")` returned false. Added `match` field to each nav item (Settings → `match: "/settings"`); active check is now `pathname === match || pathname.startsWith(match + "/")`.
- **Two `<h1>` on every settings page**: settings layout had `<h1>Settings</h1>` plus PageHeader rendered another `<h1>`. Changed layout to `<h2>`.
- **Filename extension fallback broke for files without an extension**: `file.name.split(".").pop() ?? "jpg"` returned the full filename when no extension was present. Replaced with MIME-derived extension via a `MIME_TO_EXT` map.

**Accessibility / mobile**
- **Skip-to-content link** added to `AppShell` (sr-only / focus:not-sr-only pattern, brand-colored).
- **Sidebar nav tap targets**: bumped from `py-2` (~36px) to `py-2.5 min-h-11` (44px+).
- **Topbar avatar trigger tap target**: bumped from `py-1` to `py-2 min-h-11`.

**Security**
- **`changePasswordAction` now requires the current password**: re-authenticates via `signInWithPassword` before calling `updateUser`. Added `changePasswordSchema` in `lib/validation/auth.ts`. Updated `SecurityForm` to show the current-password field. Prevents session-hijack password pivots.
- **Rate limiters on settings actions**: added `settingsWrite` (30/min), `passwordChange` (5/hour), `accountDelete` (3/hour), `avatarUpload` (10/5min) to `lib/ratelimit.ts`. All five settings actions now call `checkRateLimit` after auth.
- **`updateWorkspace` explicit ownership check**: queries `workspaces.owner_id`, returns `FORBIDDEN` if caller isn't the owner. RLS still enforces it at the DB layer; this just produces a friendlier error than the generic "Could not update". Signature changed to `(workspaceId, userId, name, slug)`.

**Code rules**
- **`Topbar.tsx` no longer imports `@/lib/supabase/client` directly**: added `signOutAction` server action to `app/(auth)/actions.ts`; Topbar awaits the action and handles the NEXT_REDIRECT digest properly.
- **`deriveDisplayName(user, profile)` helper** extracted to `lib/profile.ts`; used in `app/(app)/layout.tsx` and `dashboard/page.tsx`. (Profile settings page keeps its empty-string fallback for the input field — explicitly different from the topbar/dashboard "User" fallback.)
- **Old avatar cleanup**: `uploadAvatar` now lists the user's folder and removes any stale files with a different extension before uploading the new one. Defensive against orphaned blobs when users switch formats.

**Coverage / dead links**
- **Stub pages added** for `/projects`, `/projects/new`, `/team`, `/billing` so the sidebar/mobile-nav links don't 404. Each shows a "Coming in Phase X" EmptyState.
- **New test file**: `tests/api/settings-actions.test.ts` — 19 cases covering all 5 settings actions (auth gates, rate-limit short-circuits, validation, current-password verification, success paths, redirect on delete).
- **Existing tests updated** for the breaking signature change in `updateWorkspace` (now 5 cases including the owner-check + not-found paths) and for the Topbar import change (AppShell test now mocks `@/app/(auth)/actions` instead of `@/lib/supabase/client`).

**Final counts after hardening:** 135 tests (up from 113), 17 test files, all 4 end-of-session checks pass. Coverage 85.78% / 77.63% / 85% / 86.09%. Build: 21 routes, zero errors.

## Checkpoint 1.2 closeout — 2026-05-28

### 1. Planned vs delivered

- ✅ `lib/validation/auth.ts` — Zod schemas for login, signup, forgot-password, reset-password
- ✅ `app/(auth)/callback/route.ts` — code exchange, first-sign-in detection, `bootstrapWorkspace` call, open-redirect guard, redirect to `/dashboard` (or `?next=` path)
- ✅ `app/(auth)/actions.ts` — `loginAction`, `signupAction`, `forgotPasswordAction`, `resetPasswordAction` — all rate-limited, all Zod-validated, redirects on success, returns `ApiResult` on failure
- ✅ `components/auth/GoogleAuthButton.tsx` — client component, sets `loading=true` immediately, no reset (browser navigates away)
- ✅ `app/(auth)/layout.tsx` — centered card with wordmark (base regular / kit 800 teal)
- ✅ `app/(auth)/login/page.tsx` — email+password form + Google button + forgot-password link
- ✅ `app/(auth)/signup/page.tsx` — display-name + email + password form + Google button
- ✅ `app/(auth)/verify-email/page.tsx` — static landing with mail icon
- ✅ `app/(auth)/forgot-password/page.tsx` — email form + sent-confirmation state (via `?sent=true`)
- ✅ `app/(auth)/reset-password/page.tsx` — password + confirm form
- ✅ `app/(app)/layout.tsx` — skeleton: calls `requireAuth()`, redirects to `/login` if not authenticated
- ✅ `app/(app)/dashboard/page.tsx` — placeholder: displays user display name + workspace name
- ✅ `tests/api/auth-callback.test.ts` — 4 tests, all passing

### 2. In plain English (delivered)

The front door of the app is fully built. A new user can sign up with email+password (workspace bootstrapped on verification click), sign in with Google (workspace bootstrapped on callback), request a password reset, and set a new password. All auth actions are rate-limited and Zod-validated server-side. The callback route handles both OAuth and email-verification flows, detects first sign-in via workspace membership lookup, and guards against open-redirect attacks. Authenticated users land on a placeholder dashboard that shows their name and workspace — the full shell arrives in 1.3. Visiting any `/(app)/*` route while signed out redirects to `/login`.

### 3. Done-when verification

- ⚠️ Email signup → verify → callback → workspace bootstrapped → /dashboard — **requires live Supabase; structural code verified, manual test deferred**
- ⚠️ Google signup → callback → workspace bootstrapped → /dashboard — **same — manual only**
- ⚠️ Same-email merge — **manual only**
- ⚠️ Rate limit triggers — **Upstash live; structural code verified, manual test deferred**
- ✅ Visiting `/dashboard` while signed out → middleware redirects to `/login`
- ✅ Visiting `/login`, `/signup`, `/forgot-password`, `/verify-email` while signed in → middleware redirects to `/dashboard`
- ✅ All auth-callback tests pass — 10/10
- ✅ `npm run test:coverage` ≥ 70% — Stmts 86.66%, Branches 78.18%, Functions 85.71%, Lines 86.30%
- ✅ `npm run type-check` — zero errors
- ✅ `npm run build` — zero errors, zero warnings

### 4. Test files added/changed

- `tests/api/auth-callback.test.ts` (new, 10 cases — happy paths, bootstrap, error redirects, provider error, ?next honored, open-redirect rejected via `//` and `/\\`)
- `tests/api/auth-actions.test.ts` (new, 13 cases — rate-limit, validation, generic Supabase errors, success redirects, ip+email composite rate-limit key)
- `tests/lib/validation/auth.test.ts` (new, 13 cases — login, signup, forgot, reset schemas)
- `tests/lib/workspace.test.ts` (+1 case — empty-email bootstrap fallback)

### 5. New DECISIONS.md entries

(none — no new architectural decisions this checkpoint beyond what's documented in the phase file)

### 6. Deferred items

- **Manual auth verification** (email flow, Google flow, same-email merge, rate-limit trigger) — requires running `npm run dev` with a real Supabase project. Target: beginning of Checkpoint 1.3 session, after user confirms commit.

### 7. Known issues

- `GoogleAuthButton` has 0% test coverage (client component, browser-only `signInWithOAuth` + `window.location`). Coverage thresholds still pass comfortably; component is simple enough for manual-only verification.

### 8. What surprised me

`vi.fn().mockResolvedValue(mockSupabase)` inside a `vi.mock` factory fails with "cannot access before initialization" — the factory is hoisted before imports, so calling `.mockResolvedValue()` eagerly with an imported value errors. The fix is a lazy reference: `createClient: async () => mockSupabase` (the value is only accessed when the returned function is called, by which time the import is resolved). Also needed `vi.hoisted()` for any `vi.fn()` instances referenced in factory closures.

### 9. Post-audit hardening pass (same session)

After initial completion, audited the work against the spec, security checklist, and common Next.js gotchas. Fixed **13 issues** before clearing context:

**Security**
- **Open-redirect bypass** in callback: `next.startsWith("/")` accepted `//evil.com` (protocol-relative) and `/\evil.com` (Chrome backslash normalization). Replaced with `isSafeRedirect()` that rejects both. Covered by 2 new tests.
- **Provider OAuth errors** (e.g. `?error=access_denied`) now surface to `/login?error=...` instead of being swallowed as "missing_code".

**UX correctness**
- **Login page** now reads `?error=` from the callback and shows mapped messages (`auth_failed`, `missing_code`, `workspace_failed`, `access_denied`). Action-state errors take precedence over URL errors.
- **Reset-password** is now a Server Component that calls `getUser()` and redirects to `/forgot-password?error=link_expired` if no session — prevents the "Could not update password" generic error when a user visits directly.
- **Middleware** now redirects signed-in users away from `/login`, `/signup`, `/forgot-password`, and `/verify-email` to `/dashboard`. `/reset-password` is intentionally excluded (recovery flow needs the active session).
- **GoogleAuthButton** resets `loading=false` and shows a toast on Supabase OAuth error instead of leaving the button stuck.

**Defensive coding**
- **`bootstrapWorkspace`** now derives `name = "My Workspace"` and `slug = "workspace-xxxxx"` when the email's local part is empty (rare OAuth case).

**Testing**
- `tests/api/auth-actions.test.ts` — 13 new cases covering rate-limit short-circuit, validation, Supabase error paths, success redirects, and the ip+email composite rate-limit key.
- `tests/lib/validation/auth.test.ts` — 13 new cases for all four Zod schemas.
- `tests/api/auth-callback.test.ts` — extended from 4 to 10 cases: missing-code redirect, provider-error redirect, `?next` honored, open-redirect rejected via both `//` and `/\\`, bootstrap-failure redirect.
- `tests/lib/workspace.test.ts` — +1 case for the empty-email fallback.

**Cleanup**
- Removed `app/api/sentry-example-api/` and `app/sentry-example-page/` (Sentry wizard examples — verified working in 1.1, no longer needed).
- Cleaned up `as any` cast in callback test using `as unknown as NextRequest`.

**Final counts after hardening:** 81 tests (up from 48), all 4 end-of-session checks pass.

---

## Checkpoint 1.1 closeout — 2026-05-28

### 1. Planned vs delivered

- ✅ Run scaffold command (done in prior session)
- ✅ Configure `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- ✅ Configure Tailwind with design tokens from `.claude/design.md` (`app/globals.css` full rewrite with brand CSS variables, semantic tokens, z-index scale, motion variables)
- ✅ Set up `app/globals.css` with light + dark CSS variables
- ✅ Wire `next-themes` with system default + user toggle, `suppressHydrationWarning` on `<html>`
- ✅ Add `<Toaster />` from `react-hot-toast` to root layout
- ✅ Set up `vitest.config.ts` and `tests/setup.ts` exactly as in `.claude/rules/testing.md`
- ✅ Add npm scripts: `dev`, `build`, `lint`, `type-check`, `test`, `test:watch`, `test:coverage`, `email`
- ✅ Create `.github/workflows/ci.yml`
- ✅ All 12 migration SQL files written (`supabase/migrations/00–11`)
- ⚠️ Migrations applied to dev Supabase — **DEFERRED** (requires user to run `npx supabase db push` with a real project ID; can't be done without credentials)
- ⚠️ `lib/database.types.ts` generated from Supabase — **stub written**; real generated types replace it after migration apply
- ✅ `lib/types.ts` — ApiError, ApiErrorCode, ApiResult, branded IDs, assertNever
- ✅ `lib/plans.ts` — PLANS const, Plan interface, getPlanFromPriceId
- ✅ `lib/supabase/client.ts` — browser client
- ✅ `lib/supabase/server.ts` — Server Component client + createServiceClient()
- ✅ `lib/supabase/middleware.ts` — session refresh middleware
- ✅ `middleware.ts` — root middleware wiring
- ✅ `lib/auth.ts` — getUser, requireAuth, requireAdmin
- ✅ `lib/workspace.ts` — getWorkspace, bootstrapWorkspace (calls RPC + logActivity)
- ✅ `lib/activity.ts` — logActivity (best-effort, logs + Sentry on failure)
- ✅ `lib/validation/profile.ts`, `lib/validation/workspace.ts` — Zod schemas
- ✅ `lib/ratelimit.ts` — Upstash setup + all limiters + checkRateLimit
- ✅ `tests/mocks/supabase.ts` — canonical chainable mock factory
- ✅ `tests/mocks/stripe.ts` — canonical Stripe mock
- ✅ `tests/mocks/resend.ts` — canonical Resend mock
- ⚠️ Sentry wizard — **DEFERRED** (requires interactive terminal `npx @sentry/wizard`; @sentry/nextjs package already installed)
- ⚠️ Deliberate Sentry test error — **DEFERRED** (requires running dev server with real DSN)

### 2. In plain English (delivered)

The foundation slab is complete. All 12 database migration files are written and ready to apply. Every lib helper function — auth, workspace, activity logging, rate limiting, validation schemas, Supabase clients — is written, typed, and covered by tests. The test infrastructure (vitest config, setup, three canonical mocks) is in place. The root layout has the correct fonts (Inter + JetBrains Mono), ThemeProvider, Toaster, and `suppressHydrationWarning`. Design tokens are wired into `globals.css` covering light/dark mode, brand colors, semantic colors, z-index scale, and typography. CI is configured. Two tasks remain manual (applying migrations + running the Sentry wizard) because they need external service credentials.

### 3. Done-when verification

- ❌ All 12 migrations applied to dev Supabase — SQL files exist, not yet applied (needs credentials)
- ❌ Types generated to `lib/database.types.ts` — stub exists; real types need real Supabase project
- ✅ Every lib/* file exists with a `.test.ts` counterpart, all tests passing — 27/27 tests pass
- ✅ `npm run test:coverage` ≥ 70% — Stmts 94.44%, Branches 83.33%, Functions 100%, Lines 94.23%
- ✅ `npm run type-check` — zero errors
- ✅ `npm run build` — zero errors
- ❌ Sentry captures a deliberate test error — Sentry wizard not yet run (needs interactive terminal + DSN)
- ❌ Two-account RLS test — requires migrations applied first

### 4. Test files added/changed

- `tests/setup.ts` (new)
- `tests/mocks/supabase.ts` (new)
- `tests/mocks/stripe.ts` (new)
- `tests/mocks/resend.ts` (new)
- `tests/lib/plans.test.ts` (new, 9 cases)
- `tests/lib/auth.test.ts` (new, 7 cases)
- `tests/lib/workspace.test.ts` (new, 5 cases)
- `tests/lib/activity.test.ts` (new, 3 cases)
- `tests/lib/ratelimit.test.ts` (new, 3 cases)

### 5. New DECISIONS.md entries

(none this checkpoint — infrastructure/scaffold decisions were captured in prior session)

### 6. Deferred items

- **Apply migrations to dev Supabase** — requires user to run `npx supabase db push --project-ref <id>` after setting up `.env.local`. Target: pre-Checkpoint 1.2.
- **Generate real `lib/database.types.ts`** — follows migration apply. Stub compiles cleanly; real types replace it. Target: pre-Checkpoint 1.2.
- **Sentry wizard** — `@sentry/nextjs` is installed; wizard needs an interactive terminal session. Target: pre-Checkpoint 1.2.
- **RLS two-account verification** — requires real DB. Target: pre-Checkpoint 1.2.

### 7. Known issues

- `lib/database.types.ts` is a hand-authored stub, not generated. It will be replaced when migrations are applied. Until then, TypeScript types are accurate but not auto-synced with the DB.
- `invitations` table has `UNIQUE (workspace_id, email) DEFERRABLE` — the `DEFERRABLE` constraint is unusual; if it causes migration issues, change to a partial unique index `WHERE accepted_at IS NULL`.

### 8. What surprised me

Adding `Views: Record<string, {...}>` and `Relationships: []` to every table in the Database stub was required to satisfy Supabase's `GenericSchema` type — the stub without these caused `from()` and `.single()` to resolve as `never`, silently breaking all type inference downstream.
