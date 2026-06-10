# Changelog

All notable changes are documented here.
Format: `[YYYY-MM-DD] — Phase N — Description`

Newest entries at the top.

---

## [2026-06-09] — v1.0.0 — Production launch 🚀

Live at **[basekit.rickycodes.dev](https://basekit.rickycodes.dev)**.

- **Deployed to Vercel** on a custom domain (HTTPS), reusing the dev Supabase project as a portfolio demo backend. Verified live: Google OAuth sign-in, the full Stripe upgrade lifecycle (Checkout → prod webhook → DB flip, with real `cus_`/`sub_` IDs), and SEO (robots/sitemap/OG resolve to the prod domain).
- **One-click public demo** — "Explore the demo" signs into a shared, pre-seeded **admin** account (`demoLoginAction`); destructive writes are guarded server-side (`lib/demo.ts`), all admin reads are scoped to demo data only, and a nightly GitHub Actions job re-seeds it.
- **Email live** — verified Resend domain (`rickycodes.dev`, DKIM/SPF/DMARC), `FROM_EMAIL` switched off the sandbox sender, plain-text multipart added for deliverability.
- **Observability** — production Sentry error capture verified.
- **Lighthouse** (prod): `/` 96 Perf · **100** A11y · 100 BP · 100 SEO; `/dashboard` **100** Perf · **100** A11y.
- **Fixes found during the deploy pass** — applied the missing `notification_preferences` migration to the live DB (had silently broken `getProfile` → hidden Admin link); Topbar theme-toggle hydration guard; raised `--text-muted` + pricing-toggle contrast to WCAG AA; replaced the generic favicon with the basekit 3×3 grid icon (+ Apple touch icon).

---

## [2026-06-06] — v1.0 — Feature-complete

The full SaaS foundation, end to end. Summary of all five phases:

- **Phase 1 — Foundation + Auth + Workspaces.** Next.js 15 + Supabase + strict TypeScript scaffold; 9-table schema with RLS on every user-facing table; email/password + Google OAuth with email verification; per-user workspace bootstrap; app shell (sidebar + topbar + mobile bottom nav), settings, full dark mode. Shared Supabase/Stripe/Resend test mocks. RLS verified live (14/14).
- **Phase 2 — Billing + Webhooks + Usage.** Stripe Checkout + Customer Portal; signature-verified, idempotent webhook engine (`stripe_events`); plan derivation from price IDs; projects domain with per-plan usage limits + upgrade prompts; billing settings page. Full upgrade→cancel→past-due lifecycle verified live.
- **Phase 3 — Team + Invitations + Email.** Resend + React Email (6 templates); single-use token invitations carried through signup via an httpOnly cookie; role management + member removal; member limits re-gated at accept time. Team lifecycle verified live.
- **Phase 4 — Admin + Impersonation.** Admin overview (MRR/plan metrics + chart), user/subscription search & filters, audited plan overrides, activity log; read-observational impersonation via a signed httpOnly cookie with full audit trail. Verified live.
- **Phase 5 — Landing + Polish + Pre-deploy.** Public marketing site (8-section landing + standalone pricing/FAQ); notification preferences; past-due banner; welcome tour; empty-state polish; SEO metadata (title template, OG image, Twitter card, theme-color), `sitemap.ts` + `robots.ts`, noindex on authenticated surfaces; a11y hardening (skip links, reduced-motion, Escape-to-close nav).

Coverage threshold raised across phases to the final **85 / 85 / 80 / 85**.

---

## [2026-05-27] — Phase 0 — Project scaffolded
- CLAUDE.md rewritten to full project spec
- PROGRESS.md, DECISIONS.md, README.md, CHANGELOG.md created
- .claude/{architecture,design,schema,setup}.md authored
- .claude/rules/{code,testing,security}.md authored
- Five phase files authored (foundation, billing, team, admin, polish)
- .gitignore and .env.example committed
- All 15 architectural decisions captured in DECISIONS.md
- Ready to begin Phase 1 — Foundation + Auth + Workspaces
