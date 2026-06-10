# Decisions

Every non-obvious architectural choice with its rationale and rejected alternatives.
Add an entry here whenever a meaningful decision is made — during planning or mid-build.

---

## Admin pages are client components that fetch the 4.1 API routes (the service-role lib never enters a Server Component)
**Decision:** Every `/admin/*` page is a thin Server Component (`PageHeader` + a client "screen" component). The screen components (`AdminOverview`, `UserTable`, `UserDetail`, `SubscriptionsTable`, `ActivityLog`) fetch the existing `/api/admin/*` routes on mount, show a skeleton, then render the presentational pieces — exactly the `TeamMembers` pattern. The admin lib (`lib/admin*.ts`) is never imported by a page.
**Why:** `lib/admin*.ts` runs on the service-role client, which `security.md`/`code.md` forbid in a Server Component (it bypasses RLS). The 4.1 routes already gate that lib behind `requireAdmin()`, so consuming them from the client is the sanctioned path and reuses the tested route layer. It also makes the URL-driven search/filter/pagination a natural client concern and keeps a real skeleton on every data view (no empty flash).
**Alternatives rejected:**
- Call `listUsers()`/`getMetrics()` directly from the `(admin)` Server Components — pulls the service-role client into an RSC (the exact thing the convention bans; flagged in PR review) for no benefit, since the layout already `requireAdmin()`s.
- Server-render the page by `fetch`ing the internal route — needs an absolute URL + manual cookie forwarding; awkward versus the established client-fetch idiom.
**Date:** 2026-06-04

---

## `RevenueChart` is dynamically imported (`ssr: false`) to keep recharts out of the admin first-load bundle
**Decision:** `AdminOverview` loads `RevenueChart` via `next/dynamic(..., { ssr: false, loading: <Skeleton/> })`. recharts is only pulled in when the chart mounts client-side. Tests stub `ResizeObserver` in `tests/setup.ts` (recharts' `ResponsiveContainer` needs it under jsdom) and `AdminOverview.test` mocks the `RevenueChart` module so it doesn't depend on chart/dynamic-import timing.
**Why:** recharts is ~128 KB and below the fold — `code.md` names it as a dynamic-import target. Confirmed in the build: `/admin` first-load is 235 KB (≈ shared baseline), with recharts + `RevenueChart` in separate async chunks rather than the main bundle.
**Alternatives rejected:**
- Static import — recharts lands in every admin route's first-load even where no chart renders.
- A hand-rolled SVG sparkline — avoids the dep but loses axes/tooltips/responsiveness for a core admin view.
**Date:** 2026-06-04

---

## The admin section is reached only via a role-gated Topbar menu item
**Decision:** The single in-app entry point to `/admin` is an "Admin" item in the Topbar user menu, rendered only when `profile.role === 'admin'` (`isAdmin` flows `(app)/layout → AppShell → Topbar`). No sidebar or bottom-nav entry. Within the section, `AdminNav` handles tabs + a "Back to app" link.
**Why:** The mobile bottom nav is capped at five items (`design.md`), and the sidebar is the tenant-scoped product nav — a cross-tenant admin tool doesn't belong there. The user menu is the natural home for a privileged, rarely-used action and is visible on every breakpoint. `getProfile` already returns `role`, so the flag costs no extra query. The role check is UI sugar only; the real gate stays the layout's `requireAdmin()` + middleware.
**Alternatives rejected:**
- A sidebar/bottom-nav item — exceeds the five-item mobile cap and mixes tenant nav with cross-tenant tooling.
- No in-app link (type `/admin`) — works, but a one-click path for admins is cheap and discoverable.
**Date:** 2026-06-04

---

## Subscriptions + activity views reuse the users/activity routes; added `GET /api/admin/activity` and `stripeCustomerId` on `AdminUserRow`
**Decision:** `/admin/subscriptions` is the `/api/admin/users` list with a status filter (one subscription per workspace in v1, so the user set is the subscription set), rendering the Stripe customer deep link — which required surfacing `stripeCustomerId` on `AdminUserRow` (`listUsers` already selected the column, it was just dropped). `/admin/activity` consumes a new `GET /api/admin/activity` route wrapping the 4.1 `listActivity` lib; the overview's "recent activity" feed reuses the same route (page 1).
**Why:** A separate `listSubscriptions` would duplicate nearly all of `listUsers` for the v1 1:1 identity. `listActivity` shipped in 4.1 with no route; the activity page + overview feed both need it, so one read route serves both. Both additions are additive (no behavior change to 4.1 reads).
**Alternatives rejected:**
- A dedicated `listSubscriptions` lib + route — duplication for no extra capability at v1 scale.
- Fold activity into the metrics payload — conflates two concerns and blocks independent action-filtering/pagination on the activity page.
**Date:** 2026-06-04

---

## Admin reads run as the service role and are workspace-owner-centric (v1)
**Decision:** `lib/admin.ts` (`listUsers`, `getUserDetail`, `overrideUserPlan`, `listActivity`) runs entirely on the **service-role** client and must only be called from a `requireAdmin()`-gated route handler. The admin "user" is the **workspace owner**: `listUsers` drives from the `subscriptions` set (plan/status filter at the DB) and enriches each owner's identity (profile + `auth.users` email via `auth.admin.getUserById`, one call per owner, each isolated in try/catch like `listTeamMembers`). Because search spans email + display name (email isn't a queryable column), **search and pagination run in memory** over the enriched set.
**Why:** Admin views cross every tenant, which RLS exists to forbid — so the service role is required, and the gate is the route's `requireAdmin()`. In v1 every user owns exactly one workspace (created at signup with one free `subscriptions` row via `bootstrap_workspace`), so the subscription set is the user set 1:1 — driving from `subscriptions` makes plan/status native DB filters. Invited members still appear via their own owned workspace.
**Alternatives rejected:**
- Drive from `supabase.auth.admin.listUsers()` — native auth pagination, but plan/status become in-memory filters (the high-value narrowing filters should be native) and it mixes auth-page size with filtered results.
- Add a `profiles_select_admin`-style RLS path and use the user client — more policy surface + still can't read `auth.users` emails; the service-role route is lower operational risk (mirrors the 3.3 team-members decision).
- DB-level `range()` pagination — impossible while search is in-memory; acceptable at v1 admin scale. A searchable identity column / Postgres view is the v2 fix.
**Date:** 2026-06-04

---

## Admin metrics derive from the `subscriptions` table alone
**Decision:** `getMetrics()` issues **one** read (`subscriptions`) and computes MRR, ARR, totals, active subscribers, plan breakdown, 30-day churn, trial conversion, and the 12-month MRR trend in memory. MRR normalises annual to per-month ($276/yr→$23, $948/yr→$79) by mapping `stripe_price_id` to an amount (falling back to the plan's monthly rate for comped subs with no price). Revenue-granting statuses are `active`/`trialing`/`past_due`; `churnRate30d = canceledLast30d / (activeNow + canceledLast30d)`.
**Why:** Same v1 1:1 user↔workspace↔subscription identity as above means `subscriptions.length` is the user count and the array carries plan/status/price/created/updated/trial — everything the metrics need. One read keeps it deterministic and trivially unit-testable with fake timers (no cross-table fixtures).
**Alternatives rejected:**
- Join `profiles`/`workspaces`/`activity_log` for totals/churn — extra reads for values already derivable from the subscription set.
- Compute MRR from live Stripe — slow, rate-limited, and our `subscriptions` mirror is already the webhook-maintained source of truth.
- SQL aggregate (Postgres `sum`/`count`) — harder to unit-test against the chainable mock; the dataset is small at v1 scale.
**Date:** 2026-06-04

---

## `overrideUserPlan` bypasses Stripe and forces an access-granting status
**Decision:** A manual admin plan override writes `subscriptions.{plan_name, status:'active', cancel_at_period_end:false}` directly (service role) and logs `admin.plan_override` with `{from, to, reason, targetUserId}`. It does **not** touch Stripe. The lib self-guards (`admin.role !== 'admin'` → `FORBIDDEN`) in addition to the route's `requireAdmin()`.
**Why:** Override is for **comped / manual** plans (support, demos), so it must work without a Stripe customer. Forcing an access-granting status makes `getActivePlan` honour it immediately on the user's next render. A mandatory `reason` is what makes the audit row useful. The double admin check is defence in depth — the function writes via the service role (RLS can't catch a misuse).
**Alternatives rejected:**
- Drive the override through Stripe (create/update a subscription) — out of scope for comped plans and couples an internal action to Stripe availability.
- Trust the route's `requireAdmin()` alone — fine in practice, but a service-role writer self-guarding is cheap insurance.
- **Caveat (documented, not a blocker):** if a *live* Stripe subscription exists, the next webhook reconciles `plan_name`/`status` and can overwrite the override. Override is not meant for editing a self-serve subscriber's billing.
**Date:** 2026-06-04

---

## Admin section gate: layout `requireAdmin()` + `?error=admin_required` toast; `adminRead` vs `adminWrite` limiters
**Decision:** `app/(admin)/layout.tsx` calls `requireAdmin()` and redirects a non-admin to `/dashboard?error=admin_required`; the dashboard (a server component reading its `searchParams` prop) conditionally renders a mount-fire `AdminRequiredToast` that toasts once and `router.replace`s the param away — the exact `UpgradedToast` pattern (no `useSearchParams`, so no Suspense bailout). Middleware already lists `/admin` in its protected prefixes (bounces signed-out users to `/login`), so the role check is the layer the layout adds. Admin **reads** use a new `adminRead` limiter (60/min/admin); **writes** stay on `adminWrite` (30/min/admin).
**Why:** Defence in depth — middleware stops the unauthenticated, the layout stops authenticated non-admins before any page renders, and the API routes independently `requireAdmin()`. The query-param-driven toast reuses the established billing pattern and sidesteps the `useSearchParams` static-bailout entirely. Reads shouldn't share the stricter write budget, hence a separate read limiter.
**Alternatives rejected:**
- `useSearchParams()` in the toast component — needs a Suspense boundary or it bails out static rendering at build; the server-prop pattern is simpler and already in the codebase.
- One `adminWrite` limiter for both reads and writes — a dashboard refresh storm would eat the write budget.
**Date:** 2026-06-04

---

## invitations uniqueness is partial — one PENDING invite per (workspace, email)
**Decision:** `invitations` uniqueness is a **partial** unique index `(workspace_id, email) WHERE accepted_at IS NULL`, not a full `unique(workspace_id, email)`. So at most one *pending* invite exists per email per workspace, while *accepted* invitations don't block anything.
**Why:** The applied migration had drifted to a **full** unique constraint, which locked a `(workspace, email)` pair forever after the first accept — a member who was invited+accepted then removed could never be re-invited (insert failed `23505` → "already pending"). Found during the 2026-06-04 live pass. The partial index matches `schema.md`'s original intent: dedupe pending invites without permanently consuming the address. Applied live (dropped the full constraint, added the partial index) + fixed `combined.sql`.
**Alternatives rejected:**
- Full `unique(workspace_id, email)` (status quo) — blocks legitimate re-invitation.
- App-level pre-check instead of a DB constraint — a TOCTOU race; the partial index is race-safe and is what `inviteMember`'s `isUniqueViolation` mapping already expects.
**Date:** 2026-06-04

---

## Workspace-less authenticated users land on `/no-workspace` (not auto-bootstrap)
**Decision:** An authenticated user with no workspace membership (e.g. removed from the only workspace they joined via invitation) is redirected to a dedicated `/no-workspace` page — a `requireAuth()`-gated landing with a Sign out button — rather than to `/login`. The `(app)` layout enforces it (it runs before any child page renders); the four workspace-gated pages also point their workspace-miss redirect there for consistency.
**Why:** Phase 3's member-removal made the "authenticated but workspace-less" state reachable for the first time. The pages redirected such users to `/login`, which the middleware bounces back to `/dashboard` (they're authed) → infinite redirect loop ("too many redirects"). `/no-workspace` is exempt from both the middleware's protected prefix and its auth-only bounce, so it's a stable terminal state.
**Alternatives rejected:**
- Auto-bootstrap a fresh workspace when none exists — a transient `getWorkspace` read error also yields "no workspace", so this would silently spawn duplicate workspaces on a DB blip. Bootstrap stays a one-time signup action.
- Redirect to `/login` (status quo) — the loop.
**Date:** 2026-06-04

---

## Invitee-side accept flow split into `lib/invitation-accept.ts`
**Decision:** The invitee-side flow — `getInvitationByToken` (public token preview) and `acceptInvitation` (+ its `memberLimitReached` helper and `ACCESS_GRANTING_STATUSES`) — lives in `lib/invitation-accept.ts`. The owner-side flow — `listPendingInvitations`, `inviteMember`, `revokeInvitation` — stays in `lib/invitations.ts`. No cross-import between them (the accept module is fully self-contained on the service role).
**Why:** After adding the 3.3 accept-preview + member-limit re-gate, `lib/invitations.ts` hit 452 lines — over the 300-line soft limit (the same trigger that split `lib/team.ts` in 3.2, flagged again by the 3.3 audit). The owner-side/invitee-side seam is the natural one: the invitee-side runs entirely as the service role (the accepting/previewing user isn't a member yet), the owner-side is RLS-scoped owner/admin actions. Result: 241 + 224 lines, no barrel.
**Alternatives rejected:**
- Keep one 452-line file — over the limit; the audit flagged it.
- Split by individual function into 3+ files — over-fragmented; one seam is enough.
**Date:** 2026-06-02

---

## Enriched member data is served by a service-role route, never the team Server Component
**Decision:** The team page's member rows (display name, avatar, email) come from a new `GET /api/team/members` route handler that calls `listTeamMembers` (service role). A client wrapper (`TeamMembers`) fetches it and shows a skeleton; the page itself never touches the service-role client.
**Why:** RLS exposes only the caller's *own* profile (`profiles_select_own`) and no `auth.users` email to a teammate, so enriched member display needs the service role. `code.md`/`security.md` forbid the service-role client in a Server Component, so the enrichment lives in a route handler (allowed) and reaches the page via `fetch`. `getWorkspace` resolves the workspace via the caller's own membership, so reaching the enrichment already proves membership; the data returned is only the caller's own workspace.
**Alternatives rejected:**
- Service-role read directly in the team Server Component — violates the documented "service role only in routes/Server Actions" rule (would be an audit 🔴).
- Add a `profiles_select_same_workspace` RLS policy + read via the RLS client — gets names/avatars but still can't expose `auth.users` emails, and adds a live-DB migration + RLS re-verification for partial benefit.
**Date:** 2026-06-02

---

## Public invitation preview via an unauthenticated, rate-limited service-role route
**Decision:** `GET /api/team/invitation?token=…` returns a display-only preview (`status`, workspace name, inviter name, invited email, role) via `getInvitationByToken` (service role). It requires no session and is rate-limited by IP (`teamInviteLookup`, 20/min). It always returns 200 with a status discriminant (`valid`/`expired`/`accepted`/`not_found`).
**Why:** The `/team/accept` page must show "you've been invited to {workspace}" to a visitor who is not yet a member (and may have no account). No `invitations`-by-token RLS policy exists, and `workspaces`/cross-member `profiles` are unreadable to a non-member, so the lookup is service-role. The token is the secret — a holder is entitled to see who invited them and where.
**Alternatives rejected:**
- Server-render the preview in the accept page — same service-role-in-Server-Component rule problem.
- 404 for unknown/expired tokens — the page renders all four states as content, so a single 200 + discriminant is simpler for the client.
**Date:** 2026-06-02

---

## Team UI reuses the Phase 3.2 API routes via `fetch` (no duplicate Server Actions)
**Decision:** `InviteForm`, `MemberTable`, and `PendingInviteRow` mutate by `fetch`-ing the existing `/api/team/{invite,remove,role,revoke}` routes built in 3.2, rather than adding parallel Server Actions. Optimistic UI is done with a local `useState` working copy that reverts on a non-ok response.
**Why:** The 3.2 routes are already auth-gated, Zod-validated, rate-limited, and tested. Adding Server Actions would duplicate that boilerplate over the same lib functions for no behavior gain. `architecture.md` explicitly lists `fetch()`-from-client as a valid path, and client-owned (fetched) lists are naturally managed with `useState` optimism rather than `useOptimistic` (which keys off a Server-Component-provided prop).
**Alternatives rejected:**
- New `app/(app)/team/actions.ts` Server Actions + `useOptimistic` — duplicates the route layer; the routes are also needed for the 3.2 curl/manual-verification path.
**Date:** 2026-06-02

---

## Invite-accept signup flow carries the token in an httpOnly `bk_invite` cookie
**Decision:** When an unauthenticated invitee signs up via `/signup?invite=<token>&email=<email>`, `signupAction` writes an httpOnly `bk_invite` cookie (7-day, matching invite expiry). The `/callback` handler reads it after email verification, calls `acceptInvitation`, clears the cookie (single-use), and skips `bootstrapWorkspace` on success — joining the inviting workspace instead of creating a new one. On accept failure it falls through to `bootstrapWorkspace` so the new account still gets a workspace.
**Why:** Email verification round-trips through a mail client, so the token must survive across requests; an httpOnly cookie is the standard carrier and isn't exposed to JS. Acceptance stays the existing bearer-token model (any verified account holding the token joins) — acceptance is **not** bound to the invited email in v1 (documented limitation; the token is a 7-day single-use secret).
**Alternatives rejected:**
- Pass the token only in the query through to a post-verify redirect — Supabase's verify links don't preserve arbitrary app query params reliably.
- Bind acceptance to the invited email — rejected for v1 to keep the "sign up with any email" path simple; revisit if invite-link leakage becomes a concern.
**Date:** 2026-06-02

---

## Member limit is re-gated at accept time (service role), closing the pending-invite overshoot
**Decision:** `acceptInvitation` now re-checks the plan member limit before inserting a new membership, reading `subscriptions` + `usage` directly via the service role (it already runs as service role). At/over cap → `LIMIT_EXCEEDED` (no `upgradeUrl`, since the invitee can't upgrade someone else's workspace). The check is skipped on the idempotent already-a-member replay and fails OPEN on a read error.
**Why:** The at-invite `canAddMember` gate counts only current members, so N pending invites each pass it and could overshoot the cap when all accept (3.2 audit 🟠#2). The not-yet-member can't read usage/subscription under RLS, but the service-role accept path can — so the second barrier belongs here.
**Alternatives rejected:**
- Count pending invitations toward the limit at invite time — still races concurrent invites and doesn't help an already-issued batch.
- Leave it open (v1) — the spec Goal is "member count enforced against plan limits"; this is the clean close.
**Date:** 2026-06-02

---

## Team domain split into `lib/team.ts` (members) + `lib/invitations.ts`
**Decision:** Member management (`listMembers`, `removeMember`, `changeMemberRole`) lives in `lib/team.ts`; invitation flows (`listPendingInvitations`, `inviteMember`, `acceptInvitation`, `revokeInvitation`) live in `lib/invitations.ts`. The shared `fetchMembers` / `isOwnerOrAdmin` / `ServerClient` are exported from `lib/team.ts` and imported by `lib/invitations.ts` (one-directional dependency, no barrel file).
**Why:** A single combined module hit 506 lines — well past the 300-line soft limit (the same trigger that split `webhook-helpers.ts` out of `webhooks.ts` in 3.1). Splitting on the members-vs-invitations seam keeps each module cohesive (~188 / ~327 lines) without a re-export barrel (`code.md` discourages barrels > 5 entries).
**Alternatives rejected:**
- Keep one 506-line file — over the soft limit; the audit flagged it.
- A `lib/team/index.ts` barrel re-exporting both — barrel of 7 entries, against the rule; routes/tests import from the specific module instead.
**Date:** 2026-05-31

---

## Team domain reads the full member set once for role checks
**Decision:** `inviteMember` / `removeMember` / `changeMemberRole` / `revokeInvitation` fetch the whole `workspace_members` set for the workspace in a single query (`fetchMembers`), then derive both the actor's role and the target's role from that array — rather than issuing two separate single-row lookups.
**Why:** A workspace has at most `memberLimit` rows (≤10 on Pro), so reading the set is cheap, and it keeps the explicit owner/admin authorization check (which yields friendly FORBIDDEN errors instead of RLS's silent 0-row writes) to one round-trip. It also sidesteps the single-response-per-table limitation of the shared Supabase test mock (two same-table single lookups can't both be configured).
**Alternatives rejected:**
- Two `.maybeSingle()` lookups (actor row + target row) — two round-trips and untestable with the canonical mock.
- Rely on RLS alone — RLS silently writes 0 rows for a non-owner/admin, producing a confusing "success", so an explicit check is needed regardless.
**Date:** 2026-05-31

---

## "Already a member?" check resolves member emails (bounded by team size)
**Decision:** `inviteMember` detects an already-a-member invite by resolving each existing member's email via `auth.admin.getUserById` (service role) and comparing to the invited address — bounded by the member count — rather than resolving the invited email → user id.
**Why:** `invitations` are keyed by email but `workspace_members` is keyed by `user_id`, and `profiles` stores no email. Supabase's admin API has no email→user lookup (only `getUserById` / a full `listUsers` scan). Resolving the bounded member set (≤10) avoids both a full-user-table scan and the page-size correctness cliff of `listUsers`.
**Alternatives rejected:**
- `auth.admin.listUsers()` + `.find(email)` — O(all users) and paginated (a perPage cliff); a real correctness hazard beyond one page.
- Skip the check, rely on the `UNIQUE(workspace_id,user_id)` constraint at accept time — loses the at-invite UX signal the spec requires.
**Date:** 2026-05-31

---

## Pending-invite dedup is enforced by the DB, not a pre-check
**Decision:** `inviteMember` inserts the invitation directly and maps a unique-violation error (Postgres `23505`, or a duplicate/unique message) to a friendly "already a pending invitation" result, instead of pre-querying for an existing pending invite.
**Why:** The partial-unique index `(workspace_id, email) WHERE accepted_at IS NULL` already guarantees one pending invite per email. Letting the DB reject the duplicate is race-safe (a pre-check + insert is a TOCTOU window) and avoids a second query on the same table (which the shared mock can't distinguish from the insert read-back).
**Alternatives rejected:**
- `SELECT ... WHERE accepted_at IS NULL` before insert — racy and an extra round-trip.
**Date:** 2026-05-31

---

## `acceptInvitation` runs as the service role and is idempotent
**Decision:** Invitation acceptance uses the service-role client and, before inserting membership, checks for an existing `workspace_members` row; if present it marks `accepted_at` without re-inserting or re-incrementing usage. The `accepted_at` update is best-effort (logged, not fatal) since the membership row is the source of truth.
**Why:** The accepting user is authenticated but not yet a member, so RLS would block both the membership insert and the invitation update — service role is required. Idempotency makes a replayed accept link harmless, and not hard-failing on a late `accepted_at` write avoids telling a user "couldn't join" after they already joined.
**Alternatives rejected:**
- User-scoped client — blocked by RLS (not a member yet).
- Hard-fail if `accepted_at` update errors — would surface a false failure after a successful join.
**Date:** 2026-05-31

---

## Team API errors map to HTTP via a shared `statusForCode`; LIMIT_EXCEEDED → 403
**Decision:** The five team routes translate an `ApiError.code` to an HTTP status through `lib/http.ts → statusForCode`. `LIMIT_EXCEEDED` maps to **403** (per the Phase 3 spec), alongside `FORBIDDEN`.
**Why:** One mapping table keeps five routes consistent and is unit-tested directly. The spec explicitly calls for "403 with LIMIT_EXCEEDED" on the member cap, so the member-limit refusal is treated as a permission-style 403 (resolvable by upgrading) rather than 402/409.
**Date:** 2026-05-31

---

## `teamRole` + `teamRevoke` rate limiters added; shared `zodFieldErrors` extracted
**Decision:** Added `teamRole` and `teamRevoke` sliding-window limiters (10/min, keyed by `workspace.id`) even though `security.md`'s table enumerates only invite/accept/remove. Extracted the Zod field-error flattener into `lib/validation/errors.ts` and used it across the new routes.
**Why:** Role-change and revoke are workspace-scoped write surfaces and deserve their own buckets for clean observability, mirroring `teamRemove`. The field-error flattener was duplicated in the checkout route and `settings/actions.ts`; the team work is the third+ copy, which is the agreed trigger to extract it (the two existing copies can adopt it later).
**Alternatives rejected:**
- Reuse `teamRemove` for role/revoke — conflates three distinct surfaces in one bucket / prefix.
**Date:** 2026-05-31

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

## Unrecognized subscription prices are skipped, not written as `free`
**Decision:** In the webhook handlers, if a subscription's line-item price doesn't resolve to a known paid plan (`getPlanNameFromPriceId` returns `free` for a non-null price), the handler **skips the write and `Sentry.captureMessage`s** instead of upserting. Only `customer.subscription.deleted` legitimately writes `plan_name='free'`.
**Why:** A Stripe subscription always carries a paid price, so a price that maps to `free` means it isn't in our env config (e.g. created/renamed in the Stripe dashboard, or a grandfathered price). Building the row anyway would write `plan_name='free'` over a **paying** customer — a silent downgrade with no signal. Refusing to write leaves the existing (correct) row intact and surfaces the misconfiguration loudly. Surfaced by the post-2.1 audit (finding #2).
**Alternatives rejected:**
- Write `free` anyway (original behavior) — silently downgrades a paying customer; the failure is invisible until they complain.
- Fall back to the previous plan — guesses at intent; better to halt + alert and fix the config.
**Date:** 2026-05-29

---

## Projects use redirect-based create/delete flows, not inline optimistic UI
**Decision:** Project creation lives on a dedicated `/projects/new` page and project deletion on `/projects/[id]` behind a `ConfirmDialog`; both Server Actions `redirect("/projects")` on success rather than optimistically mutating an in-place list with `useOptimistic`. The code-rule "optimistic UI required on all mutations" is treated as satisfied by the same exception class as the documented subscription-cancel flow (confirmation modal; result is server-truth on next render).
**Why:** The Phase 2.2 spec structures the feature as three separate pages (`list`, `new`, `[id]`) with create on its own page — there is no in-place list to optimistically update at the moment of mutation, so the user is navigated to a freshly-rendered list that already reflects the server truth. Forcing `useOptimistic` onto a redirect flow would be artificial. The UX contract is still honored: the submit button shows "Creating…" (loading set before any await) and stays disabled until navigation; delete is gated behind a confirmation step. The architecture doc's inline-`ProjectList` optimistic example remains the pattern to use if/when an in-place list with inline create is built.
**Alternatives rejected:**
- Inline `useOptimistic` list with inline create form — contradicts the spec's separate-page structure; adds rollback complexity for no benefit when the page redirects anyway.
- Return `ApiResult` and `router.push` on success — `router.push` for navigation is disallowed by the loading/nav rules; `redirect()` from the action is the sanctioned path.
**Date:** 2026-05-29

---

## `projectWrite` rate limiter added despite not being in security.md's table
**Decision:** Added a `projectWrite` limiter (30/min, keyed by `user.id`) and applied it to both `createProjectAction` and `deleteProjectAction`, even though `security.md`'s rate-limit table does not list project create/delete.
**Why:** Every existing Server Action in the codebase (all five settings actions) rate-limits after auth; leaving the project actions unlimited would be the lone exception and an abuse vector (scripted project churn). 30/min mirrors `settingsWrite`. The security.md table predates the projects domain; this extends it rather than contradicting it.
**Alternatives rejected:**
- No limiter (follow the table literally) — inconsistent with every other write action; unbounded create/delete loop.
- A stricter limit — 30/min already comfortably covers legitimate burst use (creating several projects in a sitting) without being a nuisance.
**Date:** 2026-05-29

---

## Project list invalidation uses `revalidatePath`, not `revalidateTag`
**Decision:** After create/delete, the actions call `revalidatePath("/projects")` + `revalidatePath("/dashboard")` rather than the `revalidateTag("projects:" + workspaceId)` named in the phase task list.
**Why:** Same reasoning as the 2.1 decision to drop `revalidateTag` for subscriptions: `revalidateTag` is a no-op unless the underlying reads are wrapped in `unstable_cache({ tags })`, which they are not. The list/dashboard reads are dynamic Server Components (cookie-gated via `requireAuth`), so they re-fetch on every request regardless; `revalidatePath` is the honest, effective call and avoids shipping a tag that invalidates nothing. Revisit if/when these reads are wrapped in `unstable_cache`.
**Alternatives rejected:**
- `revalidateTag` per the task list — would be dead code given the reads aren't cache-tagged.
- No invalidation at all — technically fine for dynamic pages, but `revalidatePath` is cheap insurance and documents intent.
**Date:** 2026-05-29

---

## Checkout route rejects already-subscribed workspaces (409 → portal)
**Decision:** `POST /api/billing/checkout` calls `getActivePlan(workspaceId)` and, if it isn't `'free'`, returns **409** with a message telling the user to use "Manage billing" — it does not create a Checkout session. `createCheckoutSession` itself is left unguarded (it's a thin Stripe wrapper).
**Why:** This is the hard requirement carried from the 2.1 post-hardening audit: `createCheckoutSession` will happily create a **second** Stripe subscription for a workspace that already has an active paid one, and the webhook only upserts our single row — so the first subscription keeps billing → double-charge. Gating on `getActivePlan !== 'free'` (status-aware: `canceled`/`incomplete`/`unpaid` collapse to free, so re-subscribe after cancel still works) is the correct guard. Paid-tier plan changes go through the Stripe Customer Portal, never a second Checkout.
**Alternatives rejected:**
- Guard inside `createCheckoutSession` — it's a reusable primitive; the policy belongs at the route boundary where `getActivePlan` is already in scope.
- A dedicated `CONFLICT` ApiErrorCode — the enum has no `CONFLICT`; reused `VALIDATION_ERROR` with a 409 status. (Note: code/status mismatch is intentional and documented; add `CONFLICT` if a second conflict case appears.)
**Date:** 2026-05-29

---

## Billing lives at `/settings/billing`; nav active-state uses an `excludePrefix`
**Decision:** The billing page is `app/(app)/settings/billing/page.tsx`. The Sidebar/MobileNav "Billing" item points at `/settings/billing` (was the temporary top-level `/billing` stub, now deleted). The "Settings" nav item (which matches `/settings`) carries an `excludePrefix: "/settings/billing"` so that being on the billing page highlights **Billing**, not **Settings**.
**Why:** The 2.2 manual-verification notes flagged two billing URLs that disagreed: the `UpgradePrompt` CTA + the 2.3 spec target `/settings/billing` (which 404'd), while the nav pointed at the orphan `/billing` stub. Consolidating on the canonical `/settings/billing` fixes the 404 and the dead stub. But once Billing is a child of `/settings`, the existing `pathname.startsWith("/settings")` rule would light up **both** nav items on the billing page — `excludePrefix` resolves the overlap without special-casing.
**Alternatives rejected:**
- Keep Billing at top-level `/billing` with its own page — diverges from the spec/architecture doc and the `UpgradePrompt`'s `upgradeUrl` default.
- Reorder nav so the most-specific match wins — fragile; an explicit exclude is clearer and local to the data.
**Date:** 2026-05-29

---

## `PricingTable` routes paid users to the portal, never a second Checkout
**Decision:** In `PricingTable`, only **free** users get an active "Upgrade to …" CTA. For a paid user, every non-current tier renders a **disabled** "Manage in billing portal" button instead of an enabled Checkout CTA.
**Why:** With the checkout-route 409 guard in place, a paid user clicking "Upgrade to Enterprise" would get an error toast — a broken-feeling flow. Paid-tier plan changes are a Stripe Customer Portal concern (the page's "Manage billing" button sits directly above the table). Disabling + relabeling makes the intended path obvious and prevents the dead-end click. The component stays presentational (it's reused on the Phase 5 landing page, where there's no portal), so it doesn't own portal-fetch logic.
**Alternatives rejected:**
- Leave the buttons enabled and let the 409 toast educate the user — a deliberately broken click is poor UX.
- Have `PricingTable` open the portal itself — couples a presentational, landing-reused component to authenticated billing state.
**Date:** 2026-05-29

---

## Solid-fill + plan-accent color tokens; `--bg-subtle` was never defined
**Decision:** Added `--warning-solid`/`--danger-solid` (progress-bar fills) and `--accent-indigo`/`--accent-indigo-soft` (Enterprise plan badge) to both light and dark blocks in `globals.css`, and replaced an accidental `--bg-subtle` (which does not exist) with `--bg-surface-hover` across the new billing components.
**Why:** `design.md` forbids hardcoded hex in components, but the existing semantic palette only offers `bg/text/border` triples — none of which is a solid fill for a progress bar or a distinct Enterprise accent. Rather than hardcode `#f59e0b`/`#ef4444`/indigo, these get first-class tokens that also adapt to dark mode (brighter fills on the dark track). The `--bg-subtle` references were a genuine bug introduced this session: an undefined CSS variable renders no background, so the usage-bar tracks and free-plan badges would have been invisible.
**Alternatives rejected:**
- Hardcode the hex values — violates design.md and doesn't adapt to dark mode (the past-due alert's dark-brown text was unreadable on a dark surface).
- Reuse `--warning-text`/`--danger-text` for the fills — those are dark/desaturated for text legibility, not for a solid bar fill.
**Date:** 2026-05-29

---

## Billing timestamps: store ISO (timestamptz), parse as dates in UI; period from invoice LINE not top-level
**Decision:** The `subscriptions` time columns (`current_period_start/end`, `trial_end`) are Postgres `timestamptz`; the webhook writes ISO strings via `toIso()` and Supabase returns them as ISO strings (e.g. `2026-06-30T07:34:13+00:00`). UI code parses them with `new Date(value)` directly (NOT `new Date(Number(value) * 1000)`). Separately, `invoice.payment_succeeded` derives `current_period_end` from the **furthest invoice line period** (`lines.data[].period.end`), never the invoice's top-level `period_end`.
**Why:** Both were real bugs caught in the Phase 2 live verification, neither caught by unit tests (the tests asserted the wrong assumption — unix-seconds fixtures). (1) `BillingCard` treated the ISO string as unix-seconds → `Number("2026-…")` = `NaN` → "Invalid Date" on the cancel banner / trial countdown. (2) A subscription's **first invoice** has a zero-length top-level period (`period_start == period_end == creation time`), so reading `invoice.period_end` clobbered the correct period end (written by `customer.subscription.created`) with the creation timestamp — the cancel banner would show today's date instead of the real period end. The line period reflects the true billing window; taking the max across lines handles proration invoices with multiple lines.
**Alternatives rejected:**
- Store unix-seconds (bigint) instead of timestamptz — would make the columns non-human-readable in SQL and diverge from every other timestamp column in the schema.
- Read the subscription item period inside `invoice.payment_succeeded` via an extra `stripe.subscriptions.retrieve` — correct but adds an API call per invoice; the line period is already on the event payload.
**Date:** 2026-05-30

---

## Email senders are pure; templates passed as `createElement(...)` so `lib/email.ts` stays `.ts`
**Decision:** The six `sendX` functions take fully-resolved props (`to`, URLs, names) and delegate to one `sendEmail({ to, subject, react })` wrapper. They build the template via `createElement(Template, props)` rather than JSX, and `lib/email.ts` stays a `.ts` file (not `.tsx`). `sendEmail` never throws — a Resend error or network throw logs to Sentry and returns `ok: false`.
**Why:** Pure senders are unit-testable by mocking only Resend (`tests/mocks/resend.ts`) and asserting on the captured `react.type` / `react.props` — no DB or template rendering needed. The vitest coverage `include` is `lib/**/*.ts`, so renaming to `.tsx` (which JSX would require) would silently drop the file from coverage; `createElement` keeps JSX-free `.ts` while still producing a component element whose `.type`/`.props` the tests inspect. Email is never on the critical path of a user action, so a send failure must degrade gracefully, never bubble.
**Alternatives rejected:**
- `lib/email.tsx` with JSX — drops the file from the coverage glob; would need a coverage-config change to re-include.
- Resolve recipient/workspace inside each sender — couples email functions to DB lookups and forces every test to mock Supabase; resolution belongs in `getWorkspaceOwnerContact`.
**Date:** 2026-05-30

---

## Billing emails link to `/settings/billing`; webhook resolves the recipient via `getWorkspaceOwnerContact`
**Decision:** The `invoice.payment_failed` and `customer.subscription.trial_will_end` webhook handlers resolve the recipient with `getWorkspaceOwnerContact(workspaceId)` (in `lib/workspace.ts`), which reads the workspace owner's email via the service client's `supabase.auth.admin.getUserById` (+ display name from `profiles`). The email CTA points at `${NEXT_PUBLIC_SITE_URL}/settings/billing`, not a freshly-minted Stripe Customer Portal session URL.
**Why:** The webhook only has a `workspaceId`/customer; the recipient email lives in `auth.users` (the `profiles` table has no email column). `auth.admin.getUserById` from the signature-verified, server-only webhook is a justified use of the admin API — there is no user session to gate on `requireAdmin`, and it's consistent with `lib/profile.ts`'s existing `auth.admin.deleteUser` use. Linking to the in-app billing page (which hosts the "Manage billing" → portal button) avoids minting a portal session inside the webhook (an extra Stripe call whose URL can also go stale before the email is opened).
**Alternatives rejected:**
- Read the email off the Stripe customer object (`stripe.customers.retrieve`) — adds a Stripe call and depends on the customer email being set; the workspace owner is our own source of truth.
- Mint a real portal session URL in the email — extra Stripe call per event + portal URLs are short-lived/one-time, so a delayed email open would dead-end.
**Date:** 2026-05-30

---

## Email-template tests assert on `render()` HTML, not React Testing Library
**Decision:** The six `tests/components/email/*.test.tsx` files render templates with react-email's `render()` (async → HTML string) and assert on the string, rather than mounting them with `@testing-library/react` like every other component test.
**Why:** `testing.md`'s "component tests use RTL" rule targets app UI components mounted in jsdom. Email templates are full `<html><body>…</html>` documents; mounting them via RTL nests `<html>` inside jsdom's `<body>` (invalid, noisy) and RTL queries don't map cleanly to email markup. `render()` is react-email's first-class testing path and exactly mirrors what Resend renders at send time, so the assertions (CTA `href` present, conditional section present/absent) test the real output.
**Alternatives rejected:**
- RTL `render` + `screen` queries — fights the full-document structure and produces nesting warnings.
- Snapshot tests — brittle against innocuous markup/style changes; explicit `toContain` assertions are intent-revealing.
**Date:** 2026-05-30

---

## Webhook infrastructure helpers extracted to `lib/stripe/webhook-helpers.ts`
**Decision:** The pure/infrastructure helpers (`normalizeStatus`, `toIso`, `formatDate`, `refToId`, `skip`, `resolveWorkspaceId`, `buildSubscriptionFields`, `writeSubscription`, `isRecognizedPaidPrice`, `BILLING_URL`, the `ServiceClient` type) moved out of `lib/stripe/webhooks.ts` into a new `lib/stripe/webhook-helpers.ts`. `webhooks.ts` keeps only the per-event handlers + the `handleStripeEvent` dispatcher.
**Why:** Wiring real emails pushed `webhooks.ts` to 348 lines, over the 300-line soft limit in `code.md` (a split was already pre-flagged in the 2.1 closeout). Separating "parse/resolve/write infrastructure" from "event handlers" is the natural seam: handlers read top-to-bottom and the helpers are independently scannable. The public surface (`handleStripeEvent`) is unchanged, so no behavior moved and the existing tests pass untouched; `webhooks.ts` is now 254 lines.
**Alternatives rejected:**
- Leave it over the limit — accrues toward the unreadable-file failure mode the rule guards against.
- One handler file per event — over-fragmented for six short handlers that share the same helpers.
**Date:** 2026-05-30

---

## Impersonation swaps the app identity (`getUser()`) but keeps admin authorization on the real session user
**Decision:** During an active impersonation, `lib/auth.ts` `getUser()` returns the **target** user (so every Server Component / Server Action keyed off it renders the target's data), while a new `getSessionUser()` returns the real session user and `requireAdmin()` now authorizes against `getSessionUser()` — never the swapped identity. The cookie is honored only when the real session user IS the admin who minted it AND still has `role='admin'`.
**Why:** The spec's model is "`getUser()` returns the target and the app just works." But authorization must not flip — if `requireAdmin()` saw the (non-admin) target it would (a) lock the admin out of the admin section and, worse, (b) make the **end-impersonation** route impossible to authorize, dead-locking the exit. Splitting "effective app identity" (`getUser`) from "real identity for authorization" (`getSessionUser` / `requireAdmin`) lets the admin browse the impersonated app AND retain admin powers + a working Exit. When not impersonating the two are identical, so no existing behavior changes. The effective user is **reconstructed from the signed cookie** (`{...sessionUser, id: targetUserId, email: targetEmail}`), not an `auth.admin.getUserById` lookup — `getUser()` is called from Server Components, and security.md keeps `auth.admin.*` to route handlers; the cookie is tamper-proof and the target's existence is already verified at `startImpersonation`, so the read-time path needs no service-role call.
**Alternatives rejected:**
- Mint a real Supabase session for the target — needs their credentials; invasive, mutates the real session, hard to reverse.
- Swap `requireAdmin` too — locks the admin out of `/admin` and makes Exit unauthorizable.
**Date:** 2026-06-04

---

## Impersonation is read-observational in v1; completed the admin-select RLS pattern for the read path
**Decision:** Added three SELECT RLS policies — `members_select_admin` (workspace_members), `usage_select_admin` (usage), `projects_select_admin` (projects) — each `using (is_admin(auth.uid()))`, mirroring the pre-existing `*_select_admin` policies on profiles/workspaces/subscriptions/activity_log. With these, the impersonator's own RLS session can read the target's workspace/usage/projects, so `getWorkspace`/dashboard/projects render the target's data. No admin INSERT/UPDATE/DELETE-for-others policies were added, so **writes during impersonation run under the admin's own scope and are RLS-blocked for the target's workspace** — impersonation is effectively read-only.
**Why:** The app's data reads use the RLS-bound client (the admin's session cookie), and admin-select policies existed for only 4 of the 7 tables the app shell touches — without the other 3 the impersonator would hit `/no-workspace` live. Completing the pattern (SELECT-only, `is_admin`-gated) is the minimal change that makes the `getUser()`-swap model actually surface the target's data. Read-only impersonation is a safe, defensible v1 boundary (support staff observe what the user sees; they can't accidentally mutate the user's data). The new policies don't widen non-admin access, so the two-account RLS isolation test is unaffected.
**Alternatives rejected:**
- Route every impersonated read through the service role — invasive across many lib files and far more dangerous (service role bypasses ALL RLS; one unscoped query = cross-tenant leak).
- Add admin write policies too — turns impersonation into full act-as; out of scope for v1 and a larger audit surface.
**Migration note:** `combined.sql` updated; the 3 policies must be applied to the live DB (SQL Editor) and the two-account RLS test re-run before the Phase 4 live pass is signed off.
**Date:** 2026-06-04

---

## Impersonation cookie: jose HS256 JWT, key derived from the service-role secret; ending needs no requireAdmin
**Decision:** The impersonation cookie (`bk_impersonate`) is a `jose` HS256-signed JWT (`{adminId, targetUserId, targetEmail, exp}`), httpOnly + SameSite=Lax + Secure-in-prod, 30-minute TTL. The HMAC key is `SHA-256(SUPABASE_SERVICE_ROLE_KEY)` (a fixed 32-byte key; the raw secret's length isn't guaranteed ≥256 bits). `jose` was promoted from a transitive dep (via `@supabase/ssr`) to a direct dependency. The **end** route runs no `requireAdmin()` — the signed httpOnly cookie is itself the proof, and clearing it is always safe + idempotent.
**Why:** A signed JWT satisfies the spec and `jose`'s `jwtVerify` enforces both signature and `exp` (expired/forged → treated as no impersonation). Reusing the service-role secret (server-only, never `NEXT_PUBLIC_*`) avoids adding a new required env var to the contract; a leaked/forged cookie is still inert because `getUser()` only honors it for the matching, currently-authenticated admin. A dedicated `IMPERSONATION_SECRET` is a sensible prod-hardening for v2. The end route can't gate on `requireAdmin` because `getUser()` resolves to the (non-admin) target while the session is active — that would dead-lock the exit.
**Alternatives rejected:**
- Node `crypto` HMAC hand-rolled JWS — reimplements what `jose` already does correctly + edge-safely.
- New `IMPERSONATION_SECRET` env var — extra setup/config surface for marginal benefit at v1, given the cookie is only honored for the matching admin session.
**Test note:** `jose`'s Web Crypto signing checks `instanceof Uint8Array` against the module realm, which jsdom's separate realm breaks — so `tests/lib/impersonation.test.ts` runs under the `node` environment, and `tests/setup.ts` guards its DOM stubs with `typeof window`.
**Date:** 2026-06-04

## PricingTable is reused across the app billing page and the marketing site via `variant` + `ctaHref`
**Decision:** The single `components/billing/PricingTable.tsx` now serves three surfaces from two orthogonal props. `variant` ("light" default | "dark") controls visuals only — the "dark" mode uses fixed hex surfaces (not the theme-reactive CSS variables) and defaults the billing interval to annual. `ctaHref` controls CTA behavior — when set, every plan CTA becomes a `<Link>` to that href (the marketing site → `/signup`); when omitted, CTAs keep the existing Stripe Checkout flow (the app billing page). App billing renders `<PricingTable .../>` (light, checkout); the landing dark section renders `variant="dark" ctaHref="/signup"`; the `/pricing` page renders `ctaHref="/signup"` (light/theme-reactive).
**Why:** The marketing pricing must (a) match the dark "Pricing" section of the brand brief and (b) never POST to `/api/billing/checkout` (the visitor is unauthenticated — it would 401, and even authed it would 409 for a paid user). Decoupling *styling* (`variant`) from *CTA target* (`ctaHref`) lets the light/theme-reactive `/pricing` page and the always-dark landing section both route to signup without duplicating the whole component or coupling "looks dark" to "links to signup."
**Alternatives rejected:**
- A separate `MarketingPricingTable` — duplicates the plan data, toggle, and card layout; drifts from the app version over time.
- Coupling signup-CTA behavior to `variant="dark"` — blocks a light-themed `/pricing` page that still needs signup CTAs (the actual case).
**Date:** 2026-06-06

---

## Public marketing site lives in an `app/(marketing)` route group with a shared nav/footer layout; the landing pricing band is theme-independent dark
**Decision:** The landing (`/`) and `/pricing` live under `app/(marketing)/` with a shared `layout.tsx` that renders `MarketingNav` + `MarketingFooter` + a skip-to-content link, so both pages share the chrome. The placeholder `app/page.tsx` was deleted (it collided with `app/(marketing)/page.tsx` at `/`). The landing's Section 5 pricing band is rendered as a **fixed-dark** region (hardcoded `#0A0A0A` + the one allowed radial teal glow) regardless of the active theme; every other marketing section is theme-reactive via the existing CSS-variable tokens.
**Why:** A route group gives the marketing pages their own layout without affecting URLs or leaking the app shell (sidebar/topbar) onto public pages. The brand brief specifies the pricing section is *always* dark with an ambient teal glow — making just that band theme-independent (rather than the whole page) keeps the rest of the site responsive to the user's light/dark preference while honoring the brief. The radial glow is the single documented exception to design.md's "no gradients" rule.
**Date:** 2026-06-06

---

## Notification preferences are an opt-out jsonb map; `shouldSendNotification` fails open
**Decision:** `profiles.notification_preferences jsonb` stores only the kinds a user has changed; `lib/notifications.ts` merges the stored map over an all-`true` default (`DEFAULT_NOTIFICATION_PREFERENCES`), so a missing/malformed value reads as "send." `shouldSendNotification(userId, kind)` reads via the **service client** (it runs in the webhook, where there's no user session) and returns `true` on any read error or non-object value. `lib/email.ts`'s two preference-gated senders (`sendPaymentFailedEmail`, `sendTrialEndingEmail`) take an optional `recipientUserId` and only consult the preference when it's provided — the webhook passes the workspace owner's id (newly exposed on `getWorkspaceOwnerContact` as `ownerId`). Transactional emails (welcome/verify/reset/invite) are never gated. The column's UPDATE grant is widened to `(display_name, avatar_url, notification_preferences)` so users can write their own preferences under RLS.
**Why:** Opt-out + fail-open means a corrupt jsonb, a transient DB error, or a brand-new user with `{}` never silently swallows a billing-critical notice. Keeping the gate optional (`recipientUserId`) means the typed senders stay usable from contexts that don't have a user id (and the unit tests that call them directly don't need a Supabase mock). Reading via the service client is required because the send path has no authenticated user.
**Alternatives rejected:**
- Default-deny — a new user would silently miss payment-failed emails until they visited settings.
- Gating inside the webhook call sites instead of `lib/email.ts` — spreads the same preference check across handlers; centralizing it in the sender keeps one source of truth.
**Date:** 2026-06-06

## WelcomeTour: server gates on `?welcome=true`, client gates on a localStorage flag; callback sets the param for first-time signups
**Decision:** The dashboard renders `<WelcomeTour>` only when `searchParams.welcome === "true"`; the component itself renders nothing until a mount effect confirms `localStorage["basekit:welcome-dismissed"]` is absent, and dismissing writes that flag. The auth callback redirects brand-new accounts (the `bootstrapWorkspace` branch, including the failed-invite fall-through) to `/dashboard?welcome=true` instead of the bare `next`.
**Why:** Two gates keep the tour from flashing for returning users (the query param is only ever set once, at first signup; the localStorage flag survives across sessions and devices-per-browser) without needing a server-side "has seen tour" column. Reading localStorage in an effect (initial `visible=false`) keeps SSR output stable and avoids a hydration mismatch.
**Date:** 2026-06-06

---

## SEO: root title template + per-page bare titles; OG image generated via `app/opengraph-image.tsx` (not a static `/public/og.png`); noindex at the group layouts
**Decision:** The root `app/layout.tsx` owns the SEO baseline — `metadataBase: new URL(NEXT_PUBLIC_SITE_URL)`, a `title` *template* (`default: "basekit — …"`, `template: "%s · basekit"`), default OpenGraph/Twitter, and a `viewport` export with light/dark `theme-color`. Every page therefore sets a **bare** `title` (e.g. `"Dashboard"` → "Dashboard · basekit"); the marketing landing uses `title: { absolute: … }` to opt out of the template. The OG image is **generated at build** by `app/opengraph-image.tsx` (`next/og` `ImageResponse`, 1200×630, the wordmark + 3×3 grid + tagline on `#0A0A0A`) rather than shipping a static `/public/og.png`. `robots: { index: false }` is applied once on the `(app)` and `(admin)` group layouts (Next merges metadata layout→page, so it covers every authenticated page without per-page repetition); the two standalone authenticated pages outside those groups (`/no-workspace`, `/team/accept`) set it themselves. `app/sitemap.ts` + `app/robots.ts` list only public routes (`/`, `/pricing`, `/login`, `/signup`) and disallow the authenticated surfaces.
**Why:** A single template + bare titles keeps tab/SERP titles consistent and removes the duplicated `— basekit` suffix that would otherwise double under a template. Generating the OG image as code (the documented deviation from the phase plan's static `/public/og.png`) keeps the repo free of a hand-authored binary, regenerates automatically if the wordmark changes, and is verifiable via `npm run build` (the route renders as a static `○ /opengraph-image`). Setting noindex at the group-layout level is the smallest correct surface — one edit per protected section instead of one per page, and it can't be forgotten on a new page added under the group.
**Alternatives rejected:**
- A static `/public/og.png` — needs a binary asset committed + manually re-exported whenever the brand changes; `opengraph-image.tsx` is the idiomatic Next 15 file convention and stays in sync with the wordmark.
- Per-page `robots: { index: false }` on every app/admin page — repetitive and easy to omit on a future page; the layout merge-down is authoritative for the whole subtree.
**Date:** 2026-06-06

---

## Auth pages that need per-page metadata are server wrappers around client form components
**Decision:** `app/(auth)/login/page.tsx` and `app/(auth)/forgot-password/page.tsx` are now thin **server** components that export `metadata` and render a `<Suspense>`-wrapped client form extracted to a sibling file (`LoginForm.tsx`, `ForgotPasswordForm.tsx`). This matches the pre-existing `signup/page.tsx` + `SignupForm.tsx` and `reset-password/page.tsx` + `ResetPasswordForm.tsx` split. `verify-email` and `reset-password` (already server) just gained `metadata`.
**Why:** A `"use client"` module cannot export `metadata` (Next only reads it from Server Components). The pages used `useSearchParams`, which forces a client boundary + Suspense — so the fix is to push exactly that boundary down into a child form component and keep the page server-side for its metadata export. The form behavior (Suspense, `useActionState`, field errors) is unchanged.
**Date:** 2026-06-06

---

## Client Sentry is trimmed to error-tracking only (no Session Replay, no browser tracing) to meet the bundle budget
**Decision:** The Sentry setup wizard enabled Session Replay (`replayIntegration()`) and 100% browser/server tracing (`tracesSampleRate: 1`) by default — together ~87 KB gz of the client first-load. CLAUDE.md scopes Sentry to "webhook + API errors," so: `instrumentation-client.ts` drops the Replay integration and sets `tracesSampleRate: 0`; `next.config.ts` adds `bundleSizeOptimizations: { excludeTracing, excludeDebugStatements, excludeReplay* }` to tree-shake the dead code out of the bundle; `sentry.{server,edge}.config.ts` set `tracesSampleRate: 0`. Net: shared first-load floor 223 → 136 KB gz, Sentry chunk 128 → 78 KB gz. `captureException` (the actual use) is unaffected.
**Why:** Every route exceeded the 200 KB gz budget purely because of the eager client Sentry bundle. Replay + perf tracing were never in scope, and `tracesSampleRate: 1` would also burn prod transaction quota. Error capture — the stated purpose — does not need either.
**Trade-off:** No Session Replay or performance spans. If those are wanted later, re-enable in the two files (accepting the larger bundle). Authenticated pages (Supabase browser client + Sentry core floor) remain ~13–35 KB over the 200 KB budget; closing that needs lazy-loading the client SDKs — deferred (see DEPLOY.md).
**Date:** 2026-06-07

---

## Primary Button size variants meet the 44px tap-target minimum; dense variants stay compact
**Decision:** The shadcn "nova" preset shipped `Button` with a 32px default height (`h-8`). The **primary** size variants in `components/ui/button.tsx` were bumped to ≥44px (`default` → `h-11`, `lg` → `h-12`, `icon`/`icon-lg` → `size-11`); the explicitly-dense variants (`xs`, `sm`, `icon-xs`, `icon-sm`) were left compact.
**Why:** code.md mandates a 44×44px minimum tap target, and 53 of 63 button usages take the default size — so the floor must be fixed at the primitive. The dense variants are opt-in for admin-table controls (which already add `min-h-9`) where 44px would break row density, so they're exempted by intent rather than bumped globally.
**Date:** 2026-06-07

---

## Public demo is a shared admin account with server-side write-guards, impersonation limited to demo accounts, and a nightly reset
**Decision:** The landing's "Explore the demo" CTA is a one-click sign-in (`demoLoginAction`, server-side `signInWithPassword` from `DEMO_USER_EMAIL`/`DEMO_USER_PASSWORD`) into a shared, pre-seeded **admin** account so visitors see the full feature set (admin metrics, impersonation) with zero signup friction. Because that account lives in the *same database* as real accounts (the demo reuses the dev Supabase project), the destructive surfaces are guarded server-side via a pure `isDemoEmail()` (`lib/demo.ts`): account self-deletion and admin plan-override return `DEMO_DISABLED_ERROR`, and impersonation is allowed only when the target is itself a demo account (`@demo.basekit.test`). The product surfaces (projects, team, billing/Checkout, settings) stay enabled — they're RLS-scoped to the demo's own workspace and wiped nightly. A persistent `<DemoBanner>` shows on every app/admin page while signed in as a demo account. `scripts/seed-demo.mjs seed` (re)creates the demo account (admin, Free + a few projects) alongside the 16-workspace sample set; a GitHub Actions cron (`.github/workflows/reset-demo.yml`) runs it nightly to erase visitor changes.
**Why:** A provided demo beats self-signup for a portfolio — recruiter attention is seconds, and the strongest features (admin/impersonation/populated metrics) are invisible to a fresh empty signup. Admin scope maximizes the showcase; server-side guards (not just hidden UI) are mandatory because the demo shares a DB with the owner's real account. Keeping the account Free lets visitors exercise the real upgrade→Checkout flow. Identifying demo accounts by email (env + `@demo.basekit.test`) needs no migration and works as a pure check at every call site, which already has the relevant email in hand.
**Trade-off:** Shared mutable state between concurrent visitors, accepted for low portfolio traffic + nightly reset. A dedicated demo DB would remove the guard requirement but was declined to avoid re-provisioning.
**Date:** 2026-06-08

---

## All admin reads are scoped to demo data when the acting admin is the demo account
**Decision:** Because the demo admin shares the database with real accounts, the four admin reads (`listUsers`, `getUserDetail`, `getMetrics`, `listActivity`) take a `demoOnly` flag, set per-route from `isDemoEmail(actor.email)`. When true, each query is constrained to demo workspaces (`slug LIKE 'demo-%'`, via a shared `getDemoWorkspaceIds()` in `lib/admin-shared.ts`): the user list + subscriptions table show only demo accounts, metrics compute over demo subs only, the activity feed shows only demo activity, and `getUserDetail` returns `NOT_FOUND` for a non-demo workspace (so a real tenant can't be reached by guessing a URL). Real admins are unaffected (`demoOnly` is false).
**Why:** Without this, the public demo admin's user/subscription/activity tables and dashboard metrics leak the owner's real accounts (emails, plans). Scoping by the seed's `demo-*` slug (the same tag `seed-demo.mjs` teardown uses) is the one reliable dimension shared by all four reads.
**Date:** 2026-06-09

---

## Reused the dev Supabase as the production/demo backend; surfaced a migration-drift class of bug
**Decision:** v1.0 ships on Vercel pointing at the existing dev Supabase project (not a separate prod DB), an explicit portfolio-demo trade-off (see the demo-account decision above). The deploy pass surfaced that the live DB lagged the codebase: the Phase 5.2 `profiles.notification_preferences` migration had never been applied, so `getProfile`'s `SELECT` errored → `profile` was null app-wide → display names fell back to email and the Topbar **Admin** link disappeared for all admins (direct `/admin` still worked, since `requireAdmin` selects only `role`). Fixed by applying the idempotent `alter`/`grant` from `combined.sql`; a full column-by-column drift check then confirmed the live schema matches `combined.sql` (no other gaps).
**Why:** Recorded as the lesson, not just the fix — when reusing a long-lived DB as prod, **apply all pending migrations as a deploy step**; `combined.sql` is the source of truth and a `select`-every-column probe is a cheap drift check.
**Date:** 2026-06-09
