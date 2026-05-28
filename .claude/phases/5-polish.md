# Phase 5 — Landing + Polish + Pre-deploy

**Final phase. Ship-ready at the end.**

## Goal
A polished, public-facing landing page with all eight sections from the brand brief. Full accessibility audit. Performance audit. Empty states refined. Notifications page built. Documentation finished. Deployed to production with a green smoke test.

## Checkpoints

This phase is split into three checkpoints. Execute one per session. End each with the closeout protocol from CLAUDE.md.

- **Checkpoint 5.1 — Landing + pricing pages.** *Public marketing site is live (locally) — all 8 hero-to-footer sections render in light and dark, mobile and desktop.*
- **Checkpoint 5.2 — App polish.** *Notification preferences, empty-state CTAs, past-due banner, welcome tour — every rough edge inside the app is smoothed.*
- **Checkpoint 5.3 — Audits + deploy.** *A11y audit + perf audit + SEO metadata + production deploy + green smoke test on the live URL.*

---

## Checkpoint 5.1 — Landing + pricing pages

### What gets built
- `/` landing page with all 8 sections (Nav, Hero, Tech strip, Features grid, Pricing, Testimonials, CTA strip, Footer)
- `/pricing` standalone page with full feature comparison + FAQ
- Marketing components: `MarketingNav`, `Hero`, `FeatureGrid`, `Testimonials`, `MarketingFooter`
- Extended `<PricingTable variant="dark">` for the pricing section
- Theme toggle works on marketing pages too

### In plain English
The public-facing marketing site is built. A visitor lands on a polished homepage with all eight sections — a hero with two CTAs, a tech stack logo strip, a 3×2 features grid, the dark-themed pricing section with monthly/annual toggle, three developer testimonials, a final CTA strip, and the footer. There's also a standalone pricing page with a longer feature comparison table and a FAQ. The whole site works on mobile and looks intentional in both light and dark mode. No app polish or deploy work yet — that's 5.2 and 5.3.

### Done when
- All 8 landing sections render without errors in both light and dark, both mobile (375px) and desktop
- Pricing monthly/annual toggle updates all three plan cards
- `/pricing` standalone page renders with feature comparison + FAQ
- Lighthouse on `/` ≥ 90 Performance, ≥ 95 Accessibility, ≥ 95 Best Practices, ≥ 95 SEO
- All marketing component tests pass
- `npm run test:coverage` ≥ 85%; `npm run build` zero errors

### Tasks

**Landing page (`app/(marketing)/page.tsx`)** — eight sections in order:
- [ ] **Section 1 — Nav** — wordmark left, links centre (Features, Pricing, Docs, GitHub), "Sign in" + "Get started" right. Sticky on scroll. Hamburger on mobile.
- [ ] **Section 2 — Hero** — badge + H1 + sub + 2 CTAs ("Get started" → `/signup`, "Explore the demo" → `/login`). Social proof row with avatars + count.
- [ ] **Section 3 — Tech strip** — logos: Next.js, Tailwind, Supabase, Stripe, Resend, Vercel. Muted, single row, color on hover.
- [ ] **Section 4 — Features grid** — 3×2. Each cell: Tabler icon + title + 2-sentence description + tech pill.
- [ ] **Section 5 — Pricing (dark)** — `<PricingTable variant="dark">` with ambient teal glow. Monthly/annual toggle defaults to annual with "Save 20%" pill.
- [ ] **Section 6 — Testimonials** — 3 quotes with role labels (no fake names).
- [ ] **Section 7 — CTA strip** — "Ready to ship?" + 2 buttons.
- [ ] **Section 8 — Footer** — wordmark + 3 link columns + theme toggle.

**Pricing page**
- [ ] `app/(marketing)/pricing/page.tsx` — reuses `<PricingTable>` + adds long comparison table + FAQ (6-8 common questions)

**Marketing components**
- [ ] `components/marketing/MarketingNav.tsx`
- [ ] `components/marketing/Hero.tsx`
- [ ] `components/marketing/FeatureGrid.tsx`
- [ ] `components/marketing/Testimonials.tsx`
- [ ] `components/marketing/MarketingFooter.tsx`
- [ ] Extend `components/billing/PricingTable.tsx` with a `variant="dark"` mode

### Tests to write in this checkpoint

**`tests/components/MarketingNav.test.tsx`**
- `it("renders wordmark and primary links")`
- `it("collapses to hamburger below md breakpoint")`
- `it("sticky on scroll")`

**`tests/components/Hero.test.tsx`**
- `it("renders the hero headline")`
- `it("Get started button links to /signup")`
- `it("Explore demo button links to /login")`

**`tests/components/FeatureGrid.test.tsx`**
- `it("renders 6 feature cells")`
- `it("each cell has icon, title, description, tech pill")`

**`tests/components/Testimonials.test.tsx`**
- `it("renders three quotes")`
- `it("each quote has avatar with initials and role text")`

**`tests/components/MarketingFooter.test.tsx`**
- `it("renders three columns with named links")`
- `it("theme toggle is keyboard-accessible")`

**`tests/components/PricingTable.test.tsx`** (extend existing)
- `it("dark variant uses dark surface tokens")`
- `it("annual toggle is default-selected and shows 'Save 20%' pill")`
- `it("Pro card has 'MOST POPULAR' badge")`

### Manual verification for this checkpoint
- [ ] Visit `/` — all 8 sections render, no console errors, no layout shift
- [ ] Pricing monthly/annual toggle updates all 3 cards instantly
- [ ] Every CTA links to the correct page
- [ ] Mobile (375px): every section readable, no horizontal scroll
- [ ] Dark mode: pricing section already dark; other sections invert cleanly
- [ ] Lighthouse on `/` — Perf ≥ 90 / A11y ≥ 95 / BP ≥ 95 / SEO ≥ 95

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 5.1 — landing + pricing`.

---

## Checkpoint 5.2 — App polish

### What gets built
- `/settings/notifications` page with preference toggles
- `notification_preferences jsonb` column added to `profiles` (migration)
- Empty states upgraded across the app (`/projects`, `/team`, `/admin/activity`)
- `<PastDueBanner>` shown on every app page when subscription is `past_due`
- `<WelcomeTour>` card on `/dashboard?welcome=true` (dismissable to localStorage)
- Notification-preference checks wired into `lib/email.ts` sends

### In plain English
The app gets its production-grade polish. Notification preferences let users opt out of the weekly digest, payment-failed alerts, trial reminders, and member-joined notifications. Every empty state in the app now has a meaningful illustration and a clear CTA — no more naked "nothing here yet" messages. When a user's payment fails, a danger-styled banner appears at the top of every app page until they fix it, and disappears the moment Stripe confirms a successful retry. First-time signups see a brief three-step welcome card on their dashboard, which dismisses forever via localStorage.

### Done when
- `/settings/notifications` saves preferences to `profiles.notification_preferences`
- Email send functions check the relevant preference before sending
- All empty states have an illustration + headline + body + CTA
- `<PastDueBanner>` appears on `invoice.payment_failed`, disappears on `invoice.payment_succeeded`
- `<WelcomeTour>` renders on `/dashboard?welcome=true`; dismissing writes to localStorage; does not re-render on subsequent visits
- All polish component tests pass
- `npm run test:coverage` ≥ 85%; `npm run build` zero errors

### Tasks

**Migration**
- [ ] `supabase/migrations/12_notification_preferences.sql` — add `notification_preferences jsonb default '{}'::jsonb` column to `profiles`
- [ ] Regenerate types

**Notifications page**
- [ ] `app/(app)/settings/notifications/page.tsx` — toggles for: weekly_digest, payment_failed, trial_ending, member_joined, plan_changes
- [ ] `lib/notifications.ts` — `getNotificationPreferences(userId)`, `updateNotificationPreferences(userId, prefs)`, `shouldSendNotification(userId, kind)`
- [ ] Wire `shouldSendNotification` into each `sendX` in `lib/email.ts`

**Empty states polish**
- [ ] `/projects` empty → "No projects yet" + icon + "Create your first" CTA
- [ ] `/team` empty (only the owner) → "Build your team" + "Invite a teammate" CTA
- [ ] `/admin/activity` empty (rare) → "No activity in this range"
- [ ] `/settings/billing` for Free → stronger upgrade CTA placement

**Past-due banner**
- [ ] `components/billing/PastDueBanner.tsx` — full-width danger banner with "Update payment method" CTA → opens billing portal
- [ ] Render in `app/(app)/layout.tsx` when `subscription.status === 'past_due'`

**Welcome tour**
- [ ] `components/dashboard/WelcomeTour.tsx` — 3-step card (Create your first project, Invite a teammate, Upgrade to Pro). Dismiss → localStorage flag → does not re-render.
- [ ] Render in `/dashboard` when `?welcome=true` and localStorage flag absent
- [ ] Set `?welcome=true` redirect in auth callback for first-time signups

### Tests to write in this checkpoint

**`tests/lib/notifications.test.ts`**
- `it("getNotificationPreferences returns defaults when none set")`
- `it("updateNotificationPreferences merges into existing")`
- `it("shouldSendNotification('weekly_digest') respects the preference")`

**`tests/components/PastDueBanner.test.tsx`**
- `it("renders nothing when status is active")`
- `it("renders danger banner when status is past_due")`
- `it("CTA opens the billing portal")`

**`tests/components/WelcomeTour.test.tsx`**
- `it("renders when ?welcome=true and not dismissed")`
- `it("hides on dismiss and writes to localStorage")`
- `it("does not render when localStorage flag is set")`

### Manual verification for this checkpoint
- [ ] Notification preferences save and reload correctly
- [ ] Trigger Stripe `invoice.payment_failed` → past-due banner appears on every page
- [ ] Trigger Stripe `invoice.payment_succeeded` → past-due banner disappears
- [ ] Sign up a new user → land on `/dashboard?welcome=true` → tour shows
- [ ] Dismiss tour → reload → tour does not show
- [ ] Test inbox: opt out of `weekly_digest` → fire test send → no email sent
- [ ] All four upgraded empty states show their CTAs

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 5.2 — app polish + notifications`.

---

## Checkpoint 5.3 — Audits + production deploy

### What gets built
- Full a11y audit applied (skip links, focus traps verified, contrast, reduced-motion, keyboard)
- Performance audit applied (Lighthouse on `/` and `/dashboard`, dynamic imports verified, bundle budget enforced)
- SEO + metadata (root layout title template, OG image, sitemap, robots, favicon, theme-color)
- Documentation polish (README screenshots, CHANGELOG v1.0)
- Pre-deploy checklist completed (Vercel envs, Stripe prod webhook, prod Supabase, Resend domain, Upstash prod, Google OAuth prod redirect, Sentry prod)
- Production deployment + green smoke test

### In plain English
The final push to production. Every page passes a manual accessibility audit — keyboard reachable, screen-reader friendly, contrast-compliant, reduced-motion respectful. Lighthouse hits our targets on the marketing and dashboard pages. The SEO foundation (OG image, sitemap, robots, favicon, theme-color) is in place. The README has real screenshots from the live deployment and a working three-command quick start. After verifying every item on the pre-deploy checklist, we push to production and run the full signup → upgrade → cancel smoke test against the live URL. Done.

### Done when
- Lighthouse on `/` ≥ 90 Perf, ≥ 95 A11y, ≥ 95 BP, ≥ 95 SEO
- Lighthouse on `/dashboard` (logged in) ≥ 90 Perf, ≥ 95 A11y
- Manual a11y audit checklist all passed (see verification below)
- All env vars set in Vercel for Production
- Production Stripe webhook receives a triggered event
- Production Sentry receives a deliberate test error
- All 6 emails send successfully in production
- Live URL serves HTTPS on the configured domain
- Production smoke test: signup → verify → invite teammate → upgrade → cancel ALL work with test card
- CHANGELOG.md has v1.0 entry; README.md has live URL + screenshots
- `npm run test:coverage` ≥ 85%; `npm run build` zero errors

### Tasks

**A11y audit + fixes**
- [ ] Skip-to-content link in `<AppShell>` and `<MarketingNav>`
- [ ] Every modal: Escape closes + focus trap + focus return verified
- [ ] Every icon-only button: `aria-label`
- [ ] All forms: labels associated, errors linked via `aria-describedby`
- [ ] Color contrast: every text passes 4.5:1 in both light and dark
- [ ] `prefers-reduced-motion: reduce` honored everywhere — all transitions/animations disabled
- [ ] Tab landing page hero → footer with keyboard only

**Performance audit + fixes**
- [ ] Lighthouse `/` and `/dashboard` meet thresholds
- [ ] Every app page's first-load JS < 200KB gzipped
- [ ] `RevenueChart`, Stripe.js, react-email previews verified as lazy-loaded
- [ ] All images use `next/image` with explicit width/height
- [ ] Below-the-fold images have `loading="lazy"`

**SEO + metadata**
- [ ] `app/layout.tsx` metadata: title template `"%s · basekit"`, default description, OG image (`/og.png` 1200×630), Twitter card, favicon, theme-color
- [ ] Per-page metadata: landing, pricing, login, signup, dashboard (noindex on app pages)
- [ ] `app/sitemap.ts` + `app/robots.ts`
- [ ] Create `/public/og.png` (static or generated)

**Documentation**
- [ ] Update README with screenshots from production
- [ ] Update CHANGELOG with v1.0 entry summarising all phases
- [ ] Verify README quick start (3 commands) works on a fresh clone

**Pre-deploy checklist**
- [ ] All env vars set in Vercel for Production AND Preview
- [ ] Production Stripe webhook endpoint created with correct events + signing secret in Vercel env
- [ ] Production Supabase project created (separate from dev), schema migrated, RLS re-verified
- [ ] Production Resend domain verified, FROM_EMAIL updated
- [ ] Production Google OAuth client + redirect URI configured
- [ ] Production Sentry environment configured
- [ ] Production Upstash database (separate from dev)
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain
- [ ] DNS configured + Vercel domain attached

**Deploy**
- [ ] First production deploy succeeds
- [ ] Production smoke test passes (signup → verify → invite → upgrade → cancel)
- [ ] All 6 emails deliver in production (verify Resend logs)
- [ ] Stripe production webhook receives a triggered event (verify Stripe dashboard)
- [ ] Sentry receives a deliberate test event from production

### Tests to write in this checkpoint

**`tests/lib/sitemap.test.ts`**
- `it("includes public marketing routes")`
- `it("excludes /dashboard and /admin")`

(Most of this checkpoint is verification and audit work, not new code — small test surface.)

### Manual verification for this checkpoint

**A11y**
- [ ] Tab through landing — every interactive element reachable
- [ ] Tab through `/dashboard`, `/projects`, `/team`, `/settings/*` — same
- [ ] Screen reader (VoiceOver or NVDA) reads landing hero + primary CTAs correctly
- [ ] `prefers-reduced-motion: reduce` — all animations off
- [ ] Color contrast verified in dark mode (Lighthouse + manual check on teal CTAs)

**Performance**
- [ ] `npm run build` output: every page first-load JS < 200KB gzipped
- [ ] Network tab on `/` — no large unneeded JS chunks (no charts, no react-email)
- [ ] No image > 200KB delivered

**Pre-deploy / production**
- [ ] Vercel deploy succeeds for Production
- [ ] Production HTTPS works
- [ ] Sign up → verify → invite → upgrade → cancel on production with Stripe test cards
- [ ] All 6 emails deliver in production
- [ ] Stripe production webhook receives events
- [ ] Sentry receives a test event from production
- [ ] Final RLS verification on production DB

**Documentation**
- [ ] README has screenshots from production deployment
- [ ] Quick start (3 commands) works on a fresh clone
- [ ] CHANGELOG v1.0 entry present

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. **This is the final checkpoint of the project.** Suggested commit: `phase 5.3 — production deploy + v1.0`. After this commit, tag `v1.0.0`.

---

## Coverage target after this phase
Lines ≥ 85% · Functions ≥ 85% · Branches ≥ 80% · Statements ≥ 85%

**This is the final coverage threshold. Do not lower it.**
