# Basekit — Progress

## Current phase
Phase 1 — Foundation + Auth + Workspaces (in progress)

## Current checkpoint
Checkpoint 1.1 — Database + lib foundation + test mocks + Sentry (in progress — scaffold installed)

## Completed
_(no checkpoint closeouts yet — first will be added when Checkpoint 1.1 finishes)_

## In progress
- [ ] Configure `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` (next unchecked item in Checkpoint 1.1)

## Known issues
- `npm audit` reports a moderate-severity `postcss` XSS advisory pulled in transitively via Next 15. **Accepted, not fixed** — see DECISIONS.md → "Accepted postcss XSS advisory (transitive via Next 15)". Not exploitable in our context (we author all CSS); the upstream fix requires Next 16.3+. Re-evaluate when we revisit Next 16.

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
