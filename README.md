# basekit

**The foundation every SaaS needs to ship.**

A production-ready SaaS starter — auth, subscription billing, teams, admin, and transactional email all wired together end-to-end. Sign up, hit a plan limit, upgrade through Stripe, invite a teammate, cancel — the full billing lifecycle works.

**Status:** Phase 1 — Foundation + Auth + Workspaces (in progress)
**Live URL:** _(local only — not yet deployed)_

---

## Stack
- Next.js 15 (App Router · Server Components · Server Actions)
- TypeScript 5 (strict)
- Tailwind 4 + shadcn/ui + next-themes
- Supabase (Postgres + Auth + Storage)
- Stripe (Checkout + Customer Portal + Webhooks)
- Resend + React Email
- Upstash Ratelimit + Redis
- Zod · Sentry · Tabler Icons · react-hot-toast
- Vitest + React Testing Library

---

## Quick start

```bash
# 1. install
npm install

# 2. set up env
cp .env.example .env.local
# fill in values — see .claude/setup.md for where each comes from

# 3. run
npm run dev
# in a second terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Full setup** (Supabase project, Stripe products, Resend domain, Upstash database, Google OAuth, Sentry — every credential, every verification curl):
👉 [`.claude/setup.md`](.claude/setup.md)

---

## Project map

| Need | Where to look |
|------|---------------|
| Project goals & scope | [`CLAUDE.md`](CLAUDE.md) |
| Architectural decisions + rationale | [`DECISIONS.md`](DECISIONS.md) |
| What's done, in progress, next | [`PROGRESS.md`](PROGRESS.md) |
| Current sprint | [`.claude/phases/`](.claude/phases/) |
| DB schema & RLS | [`.claude/schema.md`](.claude/schema.md) |
| Design system | [`.claude/design.md`](.claude/design.md) |
| Code rules | [`.claude/rules/code.md`](.claude/rules/code.md) |
| Test rules | [`.claude/rules/testing.md`](.claude/rules/testing.md) |
| Security rules | [`.claude/rules/security.md`](.claude/rules/security.md) |

---

## Scripts

```bash
npm run dev             # local dev server (http://localhost:3000)
npm run build           # production build
npm run start           # serve production build
npm run lint            # eslint
npm run type-check      # tsc --noEmit, zero errors required to commit
npm test                # vitest run
npm run test:watch      # vitest watch mode
npm run test:coverage   # vitest with v8 coverage report
npm run email           # react-email preview server on :3001
```

---

## Definition of done (every session)

All four must pass before commit:

```bash
npm run type-check
npm test
npm run test:coverage   # at or above current phase threshold
npm run build
```

Update `PROGRESS.md` before closing the session.

---

## License

MIT — see [`LICENSE`](LICENSE) (TBA).
