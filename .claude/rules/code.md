# Code standards

Non-negotiable. Bake them in from day one — retrofitting is more expensive than enforcing.

---

## TypeScript

- **`strict: true`** in `tsconfig.json` plus `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.
- **No `any`.** If a third-party type is wrong, narrow it with `unknown` + a Zod parse, not `as any`.
- **No `@ts-ignore` / `@ts-expect-error`.** If a type error is wrong, fix the type — file an issue if it's library-side.
- **Avoid type assertions (`as Foo`)** except at well-defined boundaries (Stripe webhook payload after Zod, Supabase `Database` types). Type guards over assertions everywhere else.
- **Exhaustive switch** over discriminated unions: assign the discriminator to a `never`-returning `assertNever` helper in the default branch.
- **Branded types for IDs** that look identical but mean different things: `type WorkspaceId = string & { readonly __brand: "WorkspaceId" }`. Use in `lib/types.ts`.

---

## Query location

- **All Supabase calls live in `lib/`.** A page or component that needs data calls a named function from `lib/`. Components never import `@/lib/supabase/server` or `@/lib/supabase/client` directly.
- **Naming:** `getX`, `listX`, `createX`, `updateX`, `deleteX`, `canX` (predicate). No vague `fetchData`, `loadStuff`.
- **One function = one query.** If a feature needs three queries, write three lib functions and compose them — don't shove three queries into one function for "fewer calls."

---

## Column selection

- **Never `select("*")`.** Always explicit:
  ```ts
  await supabase.from("subscriptions").select("id, plan_name, status, current_period_end")
  ```
- **Selecting `*` is grounds for failed PR review.** It bloats payloads, defeats type narrowing, and silently widens exposure when RLS or schema changes.
- For joins, namespace the selection: `.select("id, workspace:workspaces(id, name)")`.

---

## Optimistic UI (required on all mutations)

Use the pattern from `.claude/architecture.md` (the `useOptimistic` + `useTransition` example). The rule:

1. **Compute the optimistic value before the await.**
2. **Update the optimistic state first.**
3. **Call the server action.**
4. **On success, the Server Component refetch reconciles — no extra work.**
5. **On failure, `useOptimistic` rolls back automatically; show a toast with the error message.**
6. **Never swallow the error.** A failed mutation that doesn't roll back the UI is a bug.

Mutations that explicitly do NOT need optimistic UI:
- Stripe Checkout redirect (the browser leaves the page — no UI to update)
- Subscription cancellation (intentionally shows a confirmation modal; result is server-truth on next render)

---

## Access control

- **RLS is the authorization layer.** App code does not filter by `user_id` to "be safe" — that's RLS's job, and double-filtering masks RLS misconfiguration.
- **Service role key (`SUPABASE_SERVICE_ROLE_KEY`) only in route handlers and Server Actions.** Never in a Server Component or anywhere a request returns its data to the client without filtering.
- **`requireAuth()` / `requireAdmin()`** at the top of every protected Server Component and Server Action. They throw an `ApiError` with `code: "UNAUTHENTICATED"` / `"FORBIDDEN"` which the framework converts to a redirect.
- **Admin role check** is by querying `profiles.role = 'admin'` — never by trusting a cookie or header from the client.

---

## Logging

- **No `console.log` in committed code.** Use:
  - `console.error(error)` plus `Sentry.captureException(error)` — for handled errors in server code
  - `console.warn(...)` for actionable issues that don't break a flow (e.g. "email failed to send for invite, continuing")
- **No `console.debug`** — gets shipped to prod by mistake.
- Webhook handlers MUST log `event.id`, `event.type`, and the resulting decision (`processed`, `duplicate`, `failed`) so log search is meaningful.
- Never log full JWTs, full session objects, Stripe secret keys, or webhook signatures.

---

## HTML sanitization

- Any user-generated content that is rendered as HTML (rare in this app, but possible in workspace names showing in emails or admin notes) is passed through **DOMPurify** first.
- Email templates use the React Email components which escape by default — but if you ever interpolate raw user input inside a `dangerouslySetInnerHTML`, you must sanitise.
- Markdown rendering (if added later) must use a sanitising renderer (`react-markdown` with no raw HTML, or `remark-rehype` with a strict allowlist).

---

## External API error handling

Every call to Stripe, Resend, Supabase, or Upstash must be wrapped:

```ts
try {
  const session = await stripe.checkout.sessions.create(...)
  return { ok: true as const, data: session }
} catch (error) {
  console.error("[stripe.checkout] failed", error)
  Sentry.captureException(error)
  return { ok: false as const, error: { error: "Could not start checkout. Please try again.", code: "STRIPE_ERROR" } satisfies ApiError }
}
```

- **Never re-throw raw vendor errors to the client** — they leak request IDs, account IDs, and internal field names.
- **Always include a user-facing message.** "Something went wrong" is not acceptable — it must explain what they were trying to do and what they can do next.
- **Webhook handlers swallow errors and return 200 to Stripe** (to prevent retry storms) but log + Sentry.

---

## Component size

- **300-line soft limit** per `.tsx` file. At 300 lines, extract subcomponents.
- A component that's > 100 lines AND has > 5 props is over-broad. Split by responsibility:
  - Layout container ↔ content
  - Form state ↔ form view
  - Data fetching parent (Server) ↔ presentational child (Client)
- Avoid `index.tsx` re-export barrels that span > 5 entries — they break tree shaking and make navigation worse.

---

## Comment policy

- **WHY only.** Never write a comment that describes WHAT the code does — the code itself does that.
- **Never reference tickets, PRs, sprints, or sessions.** `// fixes #123` rots. `// see PR feedback` rots faster. The git history is the audit trail.
- **Acceptable comment use:**
  - A non-obvious workaround for a library bug, with a link to the bug
  - A subtle invariant that isn't enforced by the type system
  - A warning about why a tempting "improvement" is wrong
- **One short line whenever possible.** Multi-paragraph doc-style block comments are a smell — extract a small helper with a self-documenting name instead.

---

## Error shape (the only allowed error shape)

```ts
// lib/types.ts
export interface ApiError {
  error: string
  code: ApiErrorCode
  upgradeUrl?: string   // present iff code === "LIMIT_EXCEEDED"
  fieldErrors?: Record<string, string>  // present iff code === "VALIDATION_ERROR"
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

Every API route handler, every Server Action, every lib function that can fail returns `ApiResult<T>`. No `throw` across boundaries. No `null` returns to mean "error." Throwing is reserved for true programmer errors that should crash the request (e.g. `assertNever`).

---

## Mobile rules

- **44 × 44px minimum tap target** for every interactive element. Inline links inside paragraphs are exempt.
- **No hover-only affordances.** Any action revealed by hover must also be reachable via tap (kebab menu, dropdown, long-press is NOT acceptable as the only mobile path).
- **Touch-safe drag:** drag handle is always visible on touch devices. No "press and hold" affordances.
- **No fixed-position UI without `env(safe-area-inset-*)`** — iOS notch / Dynamic Island will cover or be covered by it.
- **Test on a real phone at least once per phase.** Simulator misses keyboard behaviour and touch latency.

---

## Accessibility minimums

- **All interactive elements keyboard-reachable.** Test by unplugging the mouse and tabbing through.
- **`Escape` closes** every modal, dialog, sheet, dropdown, and popover. No exceptions.
- **Focus trap inside modals.** Tab cycles inside the modal until close. shadcn's Dialog handles this — but verify when extending.
- **Focus return** on modal close — focus returns to the element that opened it.
- **`aria-label` on every icon-only button.** Tabler icons + a button = silent screen reader otherwise.
- **`aria-live="polite"`** on toast container (react-hot-toast handles this with `<Toaster />`).
- **Form errors:** `aria-invalid="true"` plus `aria-describedby` pointing to the helper-text span.
- **No color-only state.** A red "errored" badge must also have an icon or text label. A teal "active" pill must also say "Active."
- **Skip-to-content link** at the top of the app shell.
- **Contrast** ≥ 4.5:1 for body text and ≥ 3:1 for UI controls. Verify the chosen palette in both light and dark modes.

---

## Performance rules

- **Virtualise lists with more than 100 items.** Admin user table and activity log are the realistic candidates. Add `@tanstack/react-virtual` when first list crosses the threshold — not before.
- **Dynamic-import these:**
  - `RevenueChart` (admin dashboard) — chart library is heavy and not above the fold
  - `react-email/preview` server — dev-only
  - Stripe.js — only on `/settings/billing` and `/pricing`
- **`next/image` with explicit width + height** for every raster image. No layout shift.
- **Bundle budget:** first-load JS for any app page < 200KB gzipped. Check `npm run build` output on every PR.
- **No barrel `import * from "lib"`** — tree-shaking is fragile. Import specific functions.

---

## Naming

- **Files:** kebab-case (`use-workspace.ts`, `pricing-table.tsx`).
- **React components:** PascalCase, default export (`export default function PricingTable()` — only when the file IS the component; named exports otherwise).
- **Hooks:** `useX`.
- **Server Actions:** verb-noun (`createProject`, `cancelSubscription`).
- **Boolean variables:** `is`, `has`, `can`, `should` prefix (`isLoading`, `canCreateProject`).
- **Constants:** `SCREAMING_SNAKE_CASE` only for truly global constants (plan IDs); regular `const` for everything else.
- **No abbreviations** (`subscription` not `sub`, `workspace` not `ws`). Exception: `id`, `url`, `db` — those are universal.
