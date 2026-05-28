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
- `shadcn@4.x add form` silently no-ops — install `react-hook-form` + `@hookform/resolvers` manually when the first form is built (likely Phase 1.2 or 1.3)
- `npm audit` reports 3 moderate severity vulnerabilities (all transitive) — review before deploy
- `npm warn EBADENGINE` on `mute-stream@4.0.0` wants Node ≥22.22.2 (we're on 22.14.0) — non-blocking; consider bumping Node in CI

## Setup notes

### 2026-05-27 — pre-Checkpoint 1.1 scaffold installed
The "Run scaffold command" step in Checkpoint 1.1 was completed in a Claude session before formal phase work began. State of the world for the next session:

- Next.js pinned to **15.5.18** (see DECISIONS.md → "Pinned Next.js 15 instead of accepting 16" — `create-next-app@16` was the default; AGENTS.md warning about training-data mismatch was the trigger)
- All runtime + dev deps from CLAUDE.md scaffold command installed
- shadcn **4.8.2** initialized with `--template next --base radix --preset nova`; 18 of 19 components present in `components/ui/` (form deferred per Known issues)
- `AGENTS.md` (Next 16-specific) deleted
- `.claude/settings.local.json` added to `.gitignore` and untracked
- For exact resolved versions: `npm list --depth=0` or read `package.json`

Two commits on `origin/main`:
1. `Initial commit from Create Next App`
2. `phase 1.1 scaffold — Next 15 + Tailwind 4 + shadcn + initial deps`

Resume Checkpoint 1.1 at the **Configure tsconfig.json** task — the next unchecked item in `.claude/phases/1-foundation.md`.

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
