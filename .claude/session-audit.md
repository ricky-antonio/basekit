# Session audit

Run this self-review at the end of every working session (and always before closing a
checkpoint), **after** the four gates pass but **before** committing. It is the substitute
for a second reviewer: a structured pass whose job is to find what's wrong or fragile in
what changed this session — not to restate what works.

It is part of the standard end-of-session flow (CLAUDE.md → "End of every session"). The agent
does **not** run it silently: once the gates pass it first presents a build summary, then prompts
to run the audit — so you can review what was built before the audit reframes things. The full
flow is:

**gates green → build summary → prompt to run audit → audit → resolve/defer findings → (closeout) → commit prompt**

The audit ends at a prioritized list on purpose — auditing and fixing are separate decisions, so
the agent presents findings and waits rather than silently fixing. You can also paste the **Full
prompt** below to trigger it explicitly anytime mid-session. (Use the **Compact prompt** for
small/low-risk sessions.)

---

## Full prompt

```
Audit this session before we move on. Don't restate what works — hunt for what's wrong or fragile.

First, re-read (don't trust memory): CLAUDE.md, .claude/rules/{code,testing,security}.md, and the
current phase file. Then review ONLY what changed this session — run `git status` and `git diff`
(against your last commit, plus any uncommitted work) so you know the exact surface.

Report findings grouped by severity — 🔴 must-fix-before-moving-on / 🟠 should-fix / 🟡 note-and-defer —
each with a file:line and a one-line fix. Cover every angle below explicitly; write "none" if clean,
don't silently skip:

1. Correctness & future bugs — logic errors, races, off-by-one, wrong assumptions; things that pass the
   happy path but break on reorder/retry/null/empty/concurrent/duplicate delivery.
2. Authorization & security — RLS is still the gate (no app-side user_id filtering masking a bad policy);
   service-role key only in route handlers/Server Actions; Zod validation before every DB/Stripe/external
   call; no secrets or raw vendor errors reaching the client; fail-open vs fail-closed is the RIGHT choice
   at each spot.
3. Robustness — every external call (Stripe/Supabase/Resend/Upstash) wrapped in the ApiError shape;
   idempotency wherever events/webhooks can retry; what happens when each dependency is down.
4. Spec & rules compliance — matches the current phase's "Done when" and the rules files: no `any`,
   no `console.log`, no `select("*")`, WHY-only comments, files under the size limit, naming conventions.
5. UX contract — `loading=true` as the first statement of every async handler; skeletons not empty
   flashes; `<Link>` not router.push; optimistic UI rolls back + toasts on failure; 44px tap targets;
   Escape closes modals; no color-only state.
6. Edge cases — empty/null/duplicate/expired/oversized inputs; concurrent actions; first-run vs returning;
   the unhappy half of every branch.
7. Test integrity — tests assert behavior not implementation; nothing was weakened or deleted to go green;
   new code is genuinely covered (not just threshold-passing); canonical mocks used, not inline ones.

Then:
- Confirm the four gates were actually run THIS session (type-check, test, coverage ≥ phase threshold,
  build) and report the real numbers. If you didn't run them, say so and run them now.
- Confirm PROGRESS.md + DECISIONS.md reflect what changed.
- Call out anything claimed "done" that is actually unverified or needs a manual/live step — be honest.
- Flag anything that would be over-engineering to fix now; don't invent work.

For each 🔴/🟠, recommend fix-now or defer-to-<checkpoint> with a one-line rationale.
Don't fix anything yet — give me the list first.
```

---

## Compact prompt

```
Audit this session's git diff against CLAUDE.md + the rules files + the current phase spec. Group
findings by severity with file:line: correctness/future-bugs, authz & security, robustness/error-handling,
rules compliance, UX/loading contract, edge cases, test integrity. Confirm the 4 gates ran (real numbers)
and the docs are updated. Flag anything unverified or over-engineered. Recommend fix-now vs defer — don't fix yet.
```

---

## Notes
- "Don't fix yet" is deliberate — keep the audit and the fixing as separate steps so you stay the
  decision-maker on what's worth doing before moving on.
- Tighten the angle list per phase as the spec adds surface (e.g. Phase 2 → money/billing correctness +
  webhook idempotency; Phase 4 → impersonation audit-logging + admin-route 403s).
- A clean audit is a valid outcome. The goal is an honest, prioritized list — not a quota of findings.
