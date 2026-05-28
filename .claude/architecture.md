# Architecture

How code is organised, where state lives, how data moves through the system.

---

## Directory structure

```
basekit/
├── app/                                # Next.js App Router
│   ├── (marketing)/                    # public — no auth required
│   │   ├── page.tsx                    # landing page
│   │   └── pricing/page.tsx
│   ├── (auth)/                         # auth flows — anonymous users
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── callback/route.ts           # OAuth + email verify
│   ├── (app)/                          # logged-in shell
│   │   ├── layout.tsx                  # AppShell — requires auth
│   │   ├── dashboard/page.tsx
│   │   ├── projects/                   # demo resource w/ usage limits
│   │   ├── team/page.tsx
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       ├── billing/page.tsx
│   │       ├── workspace/page.tsx
│   │       ├── notifications/page.tsx
│   │       ├── security/page.tsx
│   │       └── danger/page.tsx
│   ├── (admin)/                        # admin-only routes
│   │   ├── layout.tsx                  # requireAdmin()
│   │   └── admin/...
│   └── api/                            # route handlers (POST/etc.)
│       ├── webhooks/stripe/route.ts
│       ├── billing/*
│       ├── team/*
│       └── admin/*
├── components/                         # presentational + smart-but-pure
│   ├── layout/                         # AppShell, Sidebar, Topbar, MobileNav
│   ├── billing/                        # PricingTable, UsageBar, UpgradePrompt
│   ├── team/                           # MemberTable, InviteForm, RoleBadge
│   ├── admin/                          # UserTable, AdminMetrics, ImpersonateBanner
│   ├── email/                          # React Email templates
│   ├── dashboard/                      # MetricCard, RevenueChart, PlanBreakdown
│   └── shared/                         # PageHeader, EmptyState, ConfirmDialog
├── lib/                                # all business logic + DB access
│   ├── supabase/{client,server,middleware}.ts
│   ├── stripe/{client,webhooks,checkout,portal}.ts
│   ├── plans.ts                        # plan constants
│   ├── usage.ts                        # canCreateProject, incrementUsage, etc.
│   ├── billing.ts                      # getWorkspaceSubscription, getPlanName
│   ├── email.ts                        # sendWelcomeEmail, etc.
│   ├── auth.ts                         # getUser, requireAuth, requireAdmin
│   ├── workspace.ts                    # createWorkspace, getWorkspace
│   ├── activity.ts                     # logActivity (writes to activity_log)
│   ├── ratelimit.ts                    # Upstash Ratelimit instances
│   ├── validation/                     # Zod schemas, one file per domain
│   └── types.ts                        # shared TypeScript types + Database types
├── tests/
│   ├── setup.ts                        # global test setup (jest-dom, fake timers)
│   ├── mocks/
│   │   ├── supabase.ts                 # the ONLY supabase mock used in tests
│   │   ├── stripe.ts                   # the ONLY stripe mock
│   │   └── resend.ts
│   ├── lib/                            # one .test.ts per lib/ file
│   ├── components/                     # one .test.tsx per stateful component
│   └── api/                            # route handler integration tests
├── supabase/
│   └── migrations/                     # numbered SQL migrations
├── .claude/                            # project docs (this folder)
└── .github/workflows/ci.yml
```

**Directory rules:**
- Anything under `app/` is a route or a layout — never a reusable component.
- Anything under `lib/` is server-safe by default. Files that need browser APIs (`lib/supabase/client.ts`) say so at the top.
- Anything under `components/` is `"use client"` unless it has no interactivity (most do).
- Tests mirror the structure of the source — `lib/plans.ts` ↔ `tests/lib/plans.test.ts`.

---

## Server vs client components (Next.js 15 App Router)

**Default to Server Components.** Only mark a component `"use client"` when one of these is true:
- It uses `useState`, `useReducer`, `useEffect`, `useContext`, or any other React hook
- It binds an `onClick`, `onChange`, `onSubmit`, or other browser event
- It uses a browser-only API (`localStorage`, `window`, `IntersectionObserver`)
- It is a `<Link>` wrapper with prefetch-on-hover behaviour (rare)

**Composition rule:** Client components can import other client components, but cannot import a Server Component. A Server Component can render a client component (`<Sidebar />`) and pass it props — but the props must be serialisable (no functions, no Dates, no class instances).

**Forbidden in client components:**
- `import { createClient } from "@/lib/supabase/server"` — server-only
- `import { stripe } from "@/lib/stripe/client"` — server-only (the file is named `client.ts` because it's the Stripe SDK client, not a browser client; never import from the browser)
- `import { resend } from "@/lib/email"` — server-only
- Any `process.env.SUPABASE_SERVICE_ROLE_KEY` access — always undefined in browser

---

## Server Actions

**Use Server Actions for:**
- Form submissions on settings pages (profile update, workspace rename)
- One-shot mutations triggered from a button (cancel subscription, remove member)
- Anything that does not need to be called from outside the app

**Use API route handlers (`app/api/.../route.ts`) for:**
- Stripe webhook (`app/api/webhooks/stripe/route.ts`) — external POST
- Stripe checkout/portal redirect creation — client needs the response URL
- Anything called by `fetch()` from a client component for live data refresh

**Server Action pattern:**
```ts
// app/(app)/settings/profile/actions.ts
"use server"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { updateProfileSchema } from "@/lib/validation/profile"

export async function updateProfile(formData: FormData) {
  const user = await requireAuth()
  const parsed = updateProfileSchema.parse(Object.fromEntries(formData))
  // ...do mutation
  revalidatePath("/settings/profile")
  return { ok: true as const }
}
```

---

## State management

There is **no global client store** in v1. State responsibility breakdown:

| State | Lives in | Owned by | Explicitly NOT owned by |
|-------|----------|----------|------------------------|
| Authenticated user | Server-rendered prop from `requireAuth()` | App layout | Any client component (never call `supabase.auth.getUser()` on the client) |
| Current workspace | URL or layout prop | App layout | Client store |
| Subscription / plan | Server-rendered prop | Page that needs it | Client store |
| Toast notifications | `react-hot-toast` Toaster mounted in root layout | The toast library itself | Any custom store |
| Theme (light/dark) | `next-themes` ThemeProvider | The library | Local state |
| Form values | `useState` in the client form | The form component | Anywhere outside the form |
| Open/closed state of a dialog | `useState` in the dialog parent | The parent | Global store |
| Impersonation flag | Server-rendered from cookie | App layout | Client store |

**If a piece of state is needed in two unrelated components, lift it to the URL or to a Server Component prop — not to a global store.**

---

## Data fetching rules

- **All Supabase queries live in `lib/`.** A component that needs `subscriptions` calls `getWorkspaceSubscription(workspaceId)` from `lib/billing.ts`. Components never import `@/lib/supabase/server` directly.
- **Explicit column selection.** `.select("id, name, slug")` — never `.select("*")`. Selecting `*` makes RLS changes silently widen exposure and bloats client payloads.
- **No `await` inside a `.map()` over DB rows.** Batch with `.in()` or use a join.
- **One query per page when feasible.** Compose joins in the lib function — don't fetch list then loop fetch detail.
- **No DB call inside a client component.** If you think you need one, you actually need a Server Component parent that fetches and passes data down.

### Optimistic UI pattern (required on all mutations)

```tsx
"use client"
import { useOptimistic, useTransition } from "react"
import toast from "react-hot-toast"

export function ProjectList({ projects: serverProjects }: { projects: Project[] }) {
  const [optimisticProjects, addOptimisticProject] = useOptimistic(
    serverProjects,
    (state, newProject: Project) => [newProject, ...state],
  )
  const [isPending, startTransition] = useTransition()

  async function handleCreate(formData: FormData) {
    const tempId = crypto.randomUUID()
    const draft: Project = { id: tempId, name: String(formData.get("name")), description: null, workspace_id: "", created_at: new Date().toISOString() }

    startTransition(async () => {
      addOptimisticProject(draft)
      const result = await createProjectAction(formData)
      if (!result.ok) {
        // useOptimistic auto-rolls back when the action throws or returns failure
        toast.error(result.error.message)
      } else {
        toast.success("Project created")
      }
    })
  }
  // ...
}
```

The rule: **if a mutation can fail, the UI must show the optimistic result and roll back on failure.** `useOptimistic` handles rollback automatically as long as the failure path doesn't swallow the error.

---

## Key data flows

### Flow 1 — Signup → workspace creation
1. User submits signup form (`app/(auth)/signup/page.tsx`, client component using `useFormState`)
2. Server Action calls `supabase.auth.signUp()` (server)
3. Postgres trigger `create_profile_on_signup` inserts `profiles` row
4. `app/(auth)/callback/route.ts` receives the verify code, exchanges it
5. Callback handler calls `lib/workspace.ts → bootstrapWorkspace(userId, email)`
6. `bootstrapWorkspace` inserts `workspaces`, `workspace_members` (owner), `subscriptions` (free), `usage` rows (projects=0, members=1) — wrapped in a single Postgres function for atomicity
7. `lib/email.ts → sendWelcomeEmail(email, displayName)` (failure non-fatal)
8. `lib/activity.ts → logActivity(workspace, user, "workspace.created")`
9. Redirect to `/dashboard`

### Flow 2 — User clicks "Upgrade to Pro" → Stripe Checkout → webhook → plan flips
1. Client Pro button calls `/api/billing/checkout` with `{ priceId, billing: "monthly" }`
2. Route handler: `requireAuth()` → `getWorkspace(user)` → `getOrCreateStripeCustomer(workspace)` → `stripe.checkout.sessions.create({ ..., metadata: { workspaceId } })`
3. Browser redirects to Stripe Checkout (button shows "Redirecting to Stripe…")
4. Stripe completes payment → fires `checkout.session.completed` → POSTs to `/api/webhooks/stripe`
5. Webhook: verify signature → check `stripe_events` for idempotency → call `handleStripeEvent(event)` in `lib/stripe/webhooks.ts`
6. Handler upserts `subscriptions` row: `plan_name="pro"`, `status="trialing"`, periods set from Stripe
7. `revalidateTag("subscription:" + workspaceId)` invalidates server cache
8. `logActivity(workspace, user, "subscription.upgraded", { from: "free", to: "pro" })`
9. User redirected back to `/settings/billing?upgraded=true` — toast on render

### Flow 3 — Invite teammate → accept → workspace_members row
1. Owner submits InviteForm → Server Action `inviteMember(formData)`
2. Action: `requireAuth()` → `canAddMember(workspaceId)` (checks plan limit) — if false, return `{ ok: false, code: "LIMIT_EXCEEDED" }`
3. Insert `invitations` row with random token, 7-day expiry
4. `sendTeamInvitationEmail(email, inviterName, workspaceName, acceptUrl)`
5. Invitee clicks link → `/team/accept?token=...` → Server Component reads token
6. Server Action `acceptInvitation(token)`: verify token + not expired + not used; if invitee has no account, redirect to `/signup?invite=...`
7. On account: insert `workspace_members`, increment `usage.members`, set `invitations.accepted_at`
8. `logActivity(workspace, invitee, "member.joined")`
9. Redirect to `/dashboard`

---

## API route inventory

| Path | Method | Purpose | Rate limited |
|------|--------|---------|--------------|
| `/api/webhooks/stripe` | POST | Stripe event handler | yes (by IP, soft) |
| `/api/billing/checkout` | POST | Create Checkout session | yes (10/min/user) |
| `/api/billing/portal` | POST | Create Customer Portal session | yes (10/min/user) |
| `/api/billing/cancel` | POST | Cancel subscription at period end | yes (5/min/user) |
| `/api/team/invite` | POST | Send invitation email | yes (10/hour/workspace) |
| `/api/team/accept` | POST | Accept invitation by token | yes (10/min/IP) |
| `/api/team/remove` | POST | Remove workspace member | yes (10/min/workspace) |
| `/api/admin/users` | GET | Paginated user list (admin only) | yes (60/min/admin) |
| `/api/admin/users/[id]` | GET, PATCH | User detail / plan override | yes (60/min/admin) |
| `/api/admin/users/[id]/impersonate` | POST | Start impersonation | yes (5/min/admin) |
| `/api/admin/metrics` | GET | MRR, churn, etc. | yes (30/min/admin) |

Auth-side rate limits (login, signup, password reset) live on the auth pages themselves and are enforced inside their respective Server Actions, not API routes.

---

## Caching strategy

| Data | Cached where | Invalidation |
|------|--------------|--------------|
| Subscription / plan | `revalidateTag("subscription:<workspaceId>")` | webhook handler, server action that changes plan |
| Workspace | `revalidateTag("workspace:<workspaceId>")` | workspace settings update |
| Member list | `revalidateTag("members:<workspaceId>")` | invite, accept, remove |
| Project list | `revalidateTag("projects:<workspaceId>")` | create, delete |
| Admin metrics | 60s `revalidate` | (no manual invalidation) |
| Stripe customer | Re-fetched per request (cheap) | n/a |

No client-side caching beyond what RSC streaming provides. No Service Worker.

---

## Error shape (used everywhere)

```ts
// lib/types.ts
export interface ApiError {
  error: string                    // user-facing message
  code: ApiErrorCode               // machine-readable
  upgradeUrl?: string              // present iff code === "LIMIT_EXCEEDED"
}

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "STRIPE_ERROR"
  | "INTERNAL_ERROR"

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
```

Every API route handler, every Server Action, every lib function that can fail returns an `ApiResult<T>`. No throwing across boundaries. No `null` returns to mean "error."

---

## Performance rules

- **Virtualise lists with >100 rows.** Admin user table and activity log are the realistic candidates. Use `@tanstack/react-virtual` when needed (not installed yet — add when first list crosses the threshold).
- **Dynamic import:**
  - Charts on the admin dashboard (`RevenueChart`) — `next/dynamic` with `{ ssr: false }` and a Skeleton fallback
  - The Stripe.js script — only loaded on `/settings/billing` and the pricing page
  - React Email previews — only the `react-email` dev server, never shipped
- **Image rules:** All raster images go through `next/image` with explicit `width` and `height`. Avatars use `priority={false}` and `loading="lazy"`. The landing hero image (if any) uses `priority`.
- **Bundle budget:** First-load JS for any app page < 200KB gzipped. Verified with `npm run build` output on every PR.

---

## Multi-tenant / collaboration unlock path

The schema is already multi-tenant. Every domain table has `workspace_id`. RLS policies all key off `workspace_members.user_id = auth.uid()`. Adding new tenant features requires no schema change.

**What's in place from day 1:**
- `workspaces` table with `owner_id`
- `workspace_members` with `owner` / `admin` / `member` roles
- RLS policies filter by `workspace_id IN (membership subquery)`
- `usage` table is per-workspace
- `subscriptions` is per-workspace (one subscription per workspace, enforced by unique constraint)
- `activity_log` is per-workspace

**What v2 collaboration would need (NOT in v1):**
- Workspace switcher UI in topbar (single workspace per user in v1)
- Multi-workspace dashboard
- Workspace settings → transfer ownership flow
- "Switch to last-used workspace" cookie

**What v2 would NOT need:**
- A schema migration
- A new authorization model
- A backfill script
