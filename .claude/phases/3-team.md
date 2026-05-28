# Phase 3 — Team + Invitations + Email

**Complete this phase entirely before starting Phase 4.**

## Goal
An owner can invite a teammate by email. The teammate receives an invitation email, clicks the link, signs up (or signs in), and joins the workspace as a member. Member count is enforced against plan limits — Pro = 10, Free = 1. All six transactional email templates are built, tested, and sending through Resend.

## Checkpoints

This phase is split into three checkpoints. Execute one per session. End each with the closeout protocol from CLAUDE.md.

- **Checkpoint 3.1 — Email infrastructure + all six templates.** *Every email the app will ever send is built and previewable. Phase 2 webhook stubs (payment failed, trial ending) now send real emails.*
- **Checkpoint 3.2 — Team domain library + API routes.** *Invite/accept/remove/role flows all work via curl. No UI yet.*
- **Checkpoint 3.3 — Team UI.** *Full team management works in the browser, including the invite-accept-join loop end to end.*

---

## Checkpoint 3.1 — Email infrastructure + all six templates

### What gets built
- `lib/email.ts` — Resend wrapper + six typed send functions
- Shared `<EmailLayout>` component (header with wordmark, footer, 600px column)
- Six React Email templates: Welcome, VerifyEmail, PasswordReset, PaymentFailed, TrialEnding, TeamInvitation
- Wire Phase 2 webhook stubs to call real `sendPaymentFailedEmail` and `sendTrialEndingEmail`
- `npm run email` preview server on port 3001

### In plain English
Every transactional email the app will ever send now exists as a real, tested React Email template. You can preview them visually in a browser via `npm run email`. The Resend wrapper handles the actual sending — if Resend is down, our app keeps working and the failure gets logged to Sentry without crashing anything (emails are never on the critical path of a user action). We also retroactively wire up the two webhook stubs we left in Phase 2 (payment-failed and trial-ending) so triggering those events now sends real emails. No team UI yet — that lands in 3.2 and 3.3.

### Done when
- All six templates render in `npm run email` preview without errors, in both light and dark mode
- All `sendX` functions tested (Resend mocked, call shape verified)
- `stripe trigger invoice.payment_failed` → real PaymentFailedEmail sent (visible in Resend dashboard)
- `stripe trigger customer.subscription.trial_will_end` → real TrialEndingEmail sent
- `npm run test:coverage` ≥ 78%; `npm run build` zero errors

### Tasks

**Email infrastructure**
- [ ] `lib/email.ts` — `sendEmail({ to, subject, react })` wrapper (try/catch, log+Sentry, never throws)
- [ ] `lib/email.ts` — typed send functions: `sendWelcomeEmail`, `sendVerifyEmail`, `sendPasswordResetEmail`, `sendPaymentFailedEmail`, `sendTrialEndingEmail`, `sendTeamInvitationEmail`
- [ ] Wire Phase 2 webhook stubs (`invoice.payment_failed`, `customer.subscription.trial_will_end`) to real sends

**Templates**
- [ ] `components/email/EmailLayout.tsx` — shared header/footer wrapper
- [ ] `components/email/WelcomeEmail.tsx` — CTA "Go to dashboard"
- [ ] `components/email/VerifyEmailEmail.tsx` — backup verify email
- [ ] `components/email/PasswordResetEmail.tsx` — CTA "Reset password" + 1-hour expiry note
- [ ] `components/email/PaymentFailedEmail.tsx` — CTA "Update payment method" (links to Stripe portal)
- [ ] `components/email/TrialEndingEmail.tsx` — 3-day warning + CTA "Continue with Pro"
- [ ] `components/email/TeamInvitationEmail.tsx` — inviter + workspace name + CTA "Accept invitation"
- [ ] `npm run email` script — `email dev --dir components/email --port 3001`

### Tests to write in this checkpoint

**`tests/lib/email.test.ts`**
- `it("sendEmail calls Resend with provided args")`
- `it("sendEmail returns ok=false on Resend error (does not throw)")`
- `it("sendEmail logs to Sentry on failure")`
- `it("sendWelcomeEmail composes the right subject and react template")`
- `it("sendTeamInvitationEmail includes accept URL in template props")`
- `it("sendPaymentFailedEmail includes portal URL")`
- `it("sendTrialEndingEmail includes 3-day reminder text")`
- `it("sendPasswordResetEmail includes reset URL")`

**`tests/components/email/*` (one file per template)**
For each of the six templates:
- `it("renders without throwing given required props")`
- `it("includes the CTA URL when provided")`
- `it("does not include the conditional section when prop is missing")`

### Manual verification for this checkpoint
- [ ] Preview all 6 templates in `npm run email` — both light and dark
- [ ] `stripe trigger invoice.payment_failed` → email arrives in test inbox; content correct
- [ ] `stripe trigger customer.subscription.trial_will_end` → email arrives in test inbox
- [ ] Visual review on at least one real mobile email client (Gmail iOS or similar)
- [ ] Resend down (revoke API key temporarily) → app keeps working, Sentry captures failures

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 3.1 — email infrastructure + 6 templates`.

---

## Checkpoint 3.2 — Team domain library + API routes

### What gets built
- `lib/team.ts` — `listMembers`, `listPendingInvitations`, `inviteMember`, `acceptInvitation`, `removeMember`, `changeMemberRole`, `revokeInvitation`
- `lib/validation/team.ts` — Zod schemas
- 5 team API routes: `invite`, `accept`, `remove`, `role`, `revoke`
- Activity log writes for every team-changing action

### In plain English
The server-side machinery for team management is now built and tested. You can send invitations, accept them via token, remove members, change roles, and revoke pending invites — all via curl or directly via the API. There's no UI for any of this yet (that's 3.3), but everything behind the scenes works correctly. Member counts are enforced against plan limits, so a Pro workspace at 10 members will reject the 11th invitation with a clear `LIMIT_EXCEEDED` code. Every state-changing action is recorded in the activity log.

### Done when
- POST `/api/team/invite` with bearer token → invitation row created, email sent
- POST `/api/team/accept` with valid token → `workspace_members` row created, `usage.members` incremented, `invitations.accepted_at` set
- DELETE `/api/team/remove` → row deleted, `usage.members` decremented
- PATCH `/api/team/role` → role updated
- DELETE `/api/team/revoke` → pending invitation deleted
- Inviting at member limit → 403 with `LIMIT_EXCEEDED`
- Every team action writes the right `activity_log` row
- All team lib + API tests pass
- `npm run test:coverage` ≥ 78%; `npm run build` zero errors

### Tasks

**Team domain**
- [ ] `lib/team.ts` — all seven functions
- [ ] `lib/validation/team.ts` — Zod schemas for invite, accept, remove, role, revoke

**API routes**
- [ ] `app/api/team/invite/route.ts` — auth + admin/owner role + Zod + rate-limit + `canAddMember` + insert + send email
- [ ] `app/api/team/accept/route.ts` — token verify + expiry check + accept (rate-limit by IP)
- [ ] `app/api/team/remove/route.ts` — auth + role check + remove + decrement + log
- [ ] `app/api/team/role/route.ts` — auth + role check + update + log
- [ ] `app/api/team/revoke/route.ts` — auth + role check + delete pending invitation

**Activity log writes (wired through the lib functions)**
- [ ] `member.invited` in `inviteMember`
- [ ] `member.joined` in `acceptInvitation`
- [ ] `member.removed` in `removeMember`
- [ ] `member.role_changed` in `changeMemberRole`

### Tests to write in this checkpoint

**`tests/lib/team.test.ts`**
- `it("listMembers returns rows for workspace")`
- `it("listPendingInvitations excludes accepted ones")`
- `it("inviteMember returns LIMIT_EXCEEDED at member cap")`
- `it("inviteMember inserts invitation and sends email")`
- `it("inviteMember returns FORBIDDEN when caller is plain member")`
- `it("inviteMember returns VALIDATION_ERROR for invalid email")`
- `it("inviteMember returns ok=false when email is already a member")`
- `it("inviteMember returns ok=false when a pending invitation already exists")`
- `it("acceptInvitation returns NOT_FOUND for unknown token")`
- `it("acceptInvitation returns ok=false for expired token")`
- `it("acceptInvitation returns ok=false for already-accepted token")`
- `it("acceptInvitation creates member, sets accepted_at, increments usage")`
- `it("removeMember decrements usage")`
- `it("removeMember refuses to remove the owner")`
- `it("changeMemberRole refuses to demote the only owner")`
- `it("revokeInvitation deletes a pending invitation")`

**`tests/api/team-invite.test.ts`**
- `it("returns 401 when unauthenticated")`
- `it("returns 403 when caller is plain member")`
- `it("returns 429 when rate limited")`
- `it("returns 400 on invalid email")`
- `it("returns 403 with LIMIT_EXCEEDED at member cap")`
- `it("returns 200 with invitation id on success")`

**`tests/api/team-accept.test.ts`**
- `it("returns 400 on missing token")`
- `it("returns 404 on unknown token")`
- `it("returns ok=false on expired token")`
- `it("returns 200 on success and creates member row")`
- `it("returns 429 when rate limited")`

### Manual verification for this checkpoint
- [ ] Invite via curl (with owner bearer token) → invitation row + email arrives
- [ ] Accept via curl with token → membership created, usage incremented
- [ ] Remove via curl → member loses access on next request
- [ ] Pro at 10 members → 11th invite returns `LIMIT_EXCEEDED`
- [ ] Rate limit invite endpoint (11 in an hour) → 11th rejected
- [ ] RLS test on `invitations` and `workspace_members` (User B can't read User A's data)
- [ ] Activity log: every action appears via SQL Editor with correct `actor_id` and metadata

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. Suggested commit: `phase 3.2 — team domain + API routes`.

---

## Checkpoint 3.3 — Team UI

### What gets built
- `/team` page with `<MemberTable>` + `<InviteForm>` + pending invitations list
- Public `/team/accept` page for invitation acceptance
- Components: `MemberTable`, `InviteForm`, `RoleBadge`, `PendingInviteRow`, `AcceptInvitationCard`
- Mobile: member table converts to card layout
- Signup flow integration: `/signup?invite=<token>` joins existing workspace instead of creating new

### In plain English
The team management UI is now real. An owner navigates to `/team`, sees a table of all members, can invite new ones via a form, see pending invitations, and revoke or change roles. The MemberTable optimistically updates on remove or role change (rolling back if the server rejects). When an invitee clicks an email link, they land on a polished accept page. If they don't have an account yet, the signup form pre-fills their email and joins them to the existing workspace after they verify — instead of creating a new workspace. The full invite-accept-join loop works end to end in the browser, on desktop and mobile.

### Done when
- Owner invites teammate from `/team` → email arrives
- Invitee (no account) clicks link → signup pre-filled → after verify, lands on existing workspace's `/dashboard`
- Invitee (existing account) clicks link → accept page → click Accept → joins workspace
- Owner removes a member → row disappears optimistically; rolls back with toast if server rejects
- Owner changes role → role badge updates
- Mobile: table converts to card layout, invite form usable
- All component tests pass
- `npm run test:coverage` ≥ 78%; `npm run build` zero errors
- Full Phase 3 manual verification suite passes

### Tasks

**Pages**
- [ ] `app/(app)/team/page.tsx` — `<MemberTable>` + `<InviteForm>` + pending invitations list
- [ ] `app/(app)/team/loading.tsx` — skeleton table
- [ ] `app/team/accept/page.tsx` — public shell page (NOT under `(app)`)
- [ ] Update `app/(auth)/signup/page.tsx` to handle `?invite=<token>` and `?email=<email>` query params
- [ ] Update `app/(auth)/callback/route.ts` to call `acceptInvitation` (instead of `bootstrapWorkspace`) when invite cookie present

**Components**
- [ ] `components/team/MemberTable.tsx` — avatar, name, email, role badge, joined date, actions. Mobile: card layout.
- [ ] `components/team/InviteForm.tsx` — email + role + submit; shows `<UpgradePrompt>` at limit
- [ ] `components/team/RoleBadge.tsx` — colored pill
- [ ] `components/team/PendingInviteRow.tsx` — email, role, sent date, Revoke button
- [ ] `components/team/AcceptInvitationCard.tsx` — workspace name, "You've been invited" heading, Accept/Decline buttons

### Tests to write in this checkpoint

**`tests/components/InviteForm.test.tsx`**
- `it("validates email format on blur")`
- `it("submits with role default 'member'")`
- `it("shows UpgradePrompt when server returns LIMIT_EXCEEDED")`
- `it("clears form on success")`
- `it("shows error toast on server failure")`
- `it("button shows 'Inviting…' during submit and is disabled")`

**`tests/components/MemberTable.test.tsx`**
- `it("renders each member with name, email, role badge")`
- `it("hides the 'Remove' action for owner row")`
- `it("hides 'Change role' / 'Remove' actions when current user is a plain member")`
- `it("opens ConfirmDialog on remove click and calls action only after confirm")`
- `it("optimistically removes row on remove; restores on failure with toast")`
- `it("renders as a card layout below md breakpoint")`

**`tests/components/RoleBadge.test.tsx`**
- `it("renders 'OWNER' in brand color")`
- `it("renders 'ADMIN' in info color")`
- `it("renders 'MEMBER' in neutral color")`

**`tests/components/AcceptInvitationCard.test.tsx`**
- `it("renders workspace name and inviter name")`
- `it("Accept button calls accept action")`
- `it("Decline button discards the invitation")`

### Manual verification for this checkpoint
- [ ] Invite an unregistered email → email arrives → signup prefilled → join existing workspace (not a new one)
- [ ] Invite an already-registered user (different account) → accept screen → join workspace
- [ ] Resend the same invite → server prevents duplicate pending invitation
- [ ] Owner removes a member → loses access immediately
- [ ] Owner promotes a member to admin → admin can now invite others
- [ ] Member (non-admin) does not see `<InviteForm>` AND server rejects the API call
- [ ] Pro at 10 members → 11th invite shows UpgradePrompt
- [ ] Free plan (1 member) → first invite shows UpgradePrompt
- [ ] Owner revokes pending invitation → invitation disappears, link no longer works
- [ ] Expired invitation (manually backdate `expires_at`) → "This invitation has expired" page
- [ ] Mobile: invite + accept flow works on phone

### Closeout protocol
Follow the standard checkpoint closeout from CLAUDE.md → Checkpoint protocol. **Last checkpoint of Phase 3** — also confirm the full invite-accept-join loop works end to end before declaring the phase complete. Suggested commit: `phase 3.3 — team UI`.

---

## Coverage target after this phase
Lines ≥ 78% · Functions ≥ 78% · Branches ≥ 73% · Statements ≥ 78%
