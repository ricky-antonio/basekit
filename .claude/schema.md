# Database schema

All tables, constraints, indexes, policies, and triggers. Source of truth — `supabase/migrations/*.sql` must match this file.

---

## Tables

### `profiles`
Mirror of `auth.users` with app-level fields. Created automatically via trigger on signup.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK**, FK → `auth.users(id) ON DELETE CASCADE` | — |
| `display_name` | `text` | nullable | — |
| `avatar_url` | `text` | nullable | — |
| `role` | `text` | NOT NULL, CHECK `role IN ('user','admin')` | `'user'` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes:** `profiles_role_idx ON (role)` (for admin queries).

---

### `workspaces`
A workspace is the billing/team boundary. Every user has exactly one in v1 (created at signup).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `name` | `text` | NOT NULL | — |
| `slug` | `text` | NOT NULL, UNIQUE | — |
| `owner_id` | `uuid` | NOT NULL, FK → `auth.users(id)` | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes:** `workspaces_owner_idx ON (owner_id)`, `workspaces_slug_idx UNIQUE ON (slug)`.

---

### `workspace_members`
Many-to-many: users ↔ workspaces, with a role.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NOT NULL, FK → `workspaces(id) ON DELETE CASCADE` | — |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id) ON DELETE CASCADE` | — |
| `role` | `text` | NOT NULL, CHECK `role IN ('owner','admin','member')` | `'member'` |
| `joined_at` | `timestamptz` | NOT NULL | `now()` |

**Constraints:** UNIQUE `(workspace_id, user_id)`.
**Indexes:** `members_user_idx ON (user_id)`, `members_workspace_idx ON (workspace_id)`.

---

### `invitations`
Pending team invitations. Tokenised single-use links with 7-day expiry.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NOT NULL, FK → `workspaces(id) ON DELETE CASCADE` | — |
| `email` | `text` | NOT NULL | — |
| `role` | `text` | NOT NULL, CHECK `role IN ('admin','member')` | `'member'` |
| `token` | `text` | NOT NULL, UNIQUE | `gen_random_uuid()::text` |
| `invited_by` | `uuid` | FK → `auth.users(id)` | — |
| `accepted_at` | `timestamptz` | nullable | — |
| `expires_at` | `timestamptz` | NOT NULL | `now() + interval '7 days'` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Constraints:** UNIQUE `(workspace_id, email)` WHERE `accepted_at IS NULL` (only one pending invite per email per workspace).
**Indexes:** `invitations_token_idx UNIQUE ON (token)`, `invitations_workspace_idx ON (workspace_id)`, `invitations_email_idx ON (email) WHERE accepted_at IS NULL`.

---

### `subscriptions`
One row per workspace. Mirrors the Stripe subscription state.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NOT NULL, UNIQUE, FK → `workspaces(id) ON DELETE CASCADE` | — |
| `stripe_customer_id` | `text` | UNIQUE, nullable | — |
| `stripe_subscription_id` | `text` | UNIQUE, nullable | — |
| `stripe_price_id` | `text` | nullable | — |
| `plan_name` | `text` | NOT NULL, CHECK `plan_name IN ('free','pro','enterprise')` | `'free'` |
| `status` | `text` | NOT NULL, CHECK in `('active','trialing','past_due','canceled','incomplete','unpaid')` | `'active'` |
| `cancel_at_period_end` | `boolean` | NOT NULL | `false` |
| `current_period_start` | `timestamptz` | nullable | — |
| `current_period_end` | `timestamptz` | nullable | — |
| `trial_end` | `timestamptz` | nullable | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes:** `subscriptions_workspace_idx UNIQUE ON (workspace_id)`, `subscriptions_customer_idx UNIQUE ON (stripe_customer_id)`, `subscriptions_status_idx ON (status)`.

---

### `usage`
Counter table for plan-limited resources. One row per (workspace, resource).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NOT NULL, FK → `workspaces(id) ON DELETE CASCADE` | — |
| `resource` | `text` | NOT NULL, CHECK `resource IN ('projects','members')` | — |
| `count` | `integer` | NOT NULL, CHECK `count >= 0` | `0` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |

**Constraints:** UNIQUE `(workspace_id, resource)`.

---

### `projects`
The demo resource that demonstrates usage enforcement.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | NOT NULL, FK → `workspaces(id) ON DELETE CASCADE` | — |
| `name` | `text` | NOT NULL, CHECK `char_length(name) BETWEEN 1 AND 64` | — |
| `description` | `text` | nullable, CHECK `description IS NULL OR char_length(description) <= 500` | — |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes:** `projects_workspace_idx ON (workspace_id)`.

---

### `stripe_events`
Idempotency log. Webhook handler inserts after successful processing.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `text` | **PK** (the Stripe event ID `evt_...`) | — |
| `type` | `text` | NOT NULL | — |
| `processed_at` | `timestamptz` | NOT NULL | `now()` |

---

### `activity_log`
Append-only audit log. Admin-visible, never user-visible in v1.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | **PK** | `gen_random_uuid()` |
| `workspace_id` | `uuid` | FK → `workspaces(id) ON DELETE CASCADE` | — |
| `actor_id` | `uuid` | FK → `auth.users(id) ON DELETE SET NULL` | — |
| `impersonator_id` | `uuid` | FK → `auth.users(id) ON DELETE SET NULL`, nullable | — |
| `action` | `text` | NOT NULL | — |
| `target_type` | `text` | nullable (e.g. `'member'`, `'subscription'`, `'project'`) | — |
| `target_id` | `text` | nullable | — |
| `metadata` | `jsonb` | NOT NULL | `'{}'::jsonb` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |

**Indexes:** `activity_workspace_idx ON (workspace_id, created_at DESC)`, `activity_actor_idx ON (actor_id, created_at DESC)`, `activity_action_idx ON (action)`.

**Action vocabulary** (extend by appending):
- `workspace.created`
- `workspace.updated`
- `member.invited`
- `member.joined`
- `member.removed`
- `member.role_changed`
- `subscription.upgraded`
- `subscription.downgraded`
- `subscription.canceled`
- `subscription.reactivated`
- `project.created`
- `project.deleted`
- `admin.impersonation_started`
- `admin.impersonation_ended`
- `admin.plan_override`

---

## Enums (text-with-CHECK pattern)

We use `text + CHECK` instead of Postgres `ENUM` types because adding values to a Postgres ENUM in production requires migration ceremony. Text + CHECK lets us extend with a single migration.

| Domain | Values | Used in |
|--------|--------|---------|
| User role | `user`, `admin` | `profiles.role` |
| Member role | `owner`, `admin`, `member` | `workspace_members.role` |
| Invite role | `admin`, `member` | `invitations.role` |
| Plan | `free`, `pro`, `enterprise` | `subscriptions.plan_name` |
| Sub status | `active`, `trialing`, `past_due`, `canceled`, `incomplete`, `unpaid` | `subscriptions.status` |
| Resource | `projects`, `members` | `usage.resource` |

---

## Foreign-key dependency graph

```
auth.users ◄────────────────┬──────── profiles
                            │
                            ├──────── workspaces (owner_id)
                            │
                            ├──────── workspace_members (user_id)
                            │
                            ├──────── invitations (invited_by)
                            │
                            └──────── activity_log (actor_id, impersonator_id)

workspaces ◄────────────────┬──────── workspace_members (workspace_id)
                            ├──────── invitations (workspace_id)
                            ├──────── subscriptions (workspace_id)
                            ├──────── usage (workspace_id)
                            ├──────── projects (workspace_id)
                            └──────── activity_log (workspace_id)

(stripe_events has no FKs — it's a flat idempotency log)
```

---

## RLS policies

**Enable RLS on every table** except `stripe_events` (which is service-role-only and never read by users):

```sql
alter table profiles            enable row level security;
alter table workspaces          enable row level security;
alter table workspace_members   enable row level security;
alter table invitations         enable row level security;
alter table subscriptions       enable row level security;
alter table usage               enable row level security;
alter table projects            enable row level security;
alter table activity_log        enable row level security;
```

### `profiles`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `profiles_select_own` | SELECT | `id = auth.uid()` |
| `profiles_update_own` | UPDATE | `id = auth.uid()` |
| `profiles_select_admin` | SELECT | `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')` |

### `workspaces`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `workspaces_select_members` | SELECT | `id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())` |
| `workspaces_update_owner` | UPDATE | `owner_id = auth.uid()` |
| `workspaces_delete_owner` | DELETE | `owner_id = auth.uid()` |
| `workspaces_select_admin` | SELECT | admin role check |

### `workspace_members`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `members_select_same_workspace` | SELECT | `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())` |
| `members_update_owner_or_admin` | UPDATE | actor's row in `workspace_members` for same workspace has role `owner` or `admin` |
| `members_delete_owner_or_admin` | DELETE | same as above; owner cannot be deleted (enforced at app layer + a CHECK on UPDATE preventing role change of the only owner) |

### `invitations`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `invitations_select_workspace` | SELECT | workspace member |
| `invitations_insert_owner_or_admin` | INSERT | owner or admin of workspace |
| `invitations_delete_owner_or_admin` | DELETE | owner or admin of workspace |
| `invitations_select_by_token` | SELECT | true (token is the secret; the lookup happens via service role on `/api/team/accept`, so this policy is effectively unused by anon — left explicit to document intent) |

### `subscriptions`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `subscriptions_select_members` | SELECT | workspace member |
| `subscriptions_select_admin` | SELECT | admin role check |
| (no INSERT/UPDATE/DELETE policy — only service role writes) | — | — |

### `usage`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `usage_select_members` | SELECT | workspace member |
| (no write policy — only service role / RPC writes) | — | — |

### `projects`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `projects_select_members` | SELECT | workspace member |
| `projects_insert_members` | INSERT | workspace member |
| `projects_update_members` | UPDATE | workspace member |
| `projects_delete_owner_or_admin` | DELETE | owner or admin of workspace |

### `activity_log`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `activity_select_admin` | SELECT | admin role check |
| (no other policies — only service role writes) | — | — |

---

## Triggers

### `create_profile_on_signup`
**Event:** AFTER INSERT ON `auth.users`
**Action:** inserts a `profiles` row with `id = NEW.id`.

```sql
create or replace function create_profile_on_signup()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();
```

### `update_updated_at`
**Event:** BEFORE UPDATE ON `profiles`, `subscriptions`, `usage`, `workspaces`
**Action:** sets `NEW.updated_at = now()`.

```sql
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at      before update on profiles      for each row execute function update_updated_at();
create trigger subscriptions_updated_at before update on subscriptions for each row execute function update_updated_at();
create trigger usage_updated_at         before update on usage         for each row execute function update_updated_at();
```

---

## Postgres functions (RPC)

### `bootstrap_workspace(user_id uuid, default_name text, default_slug text)`
Atomic creation of `workspaces` + `workspace_members(owner)` + `subscriptions(free)` + `usage(projects=0, members=1)` in a single transaction. Returns the new `workspaces.id`. Called from the auth callback.

### `increment_usage(p_workspace_id uuid, p_resource text)`
Atomic UPSERT then increment. Avoids race conditions on parallel project creation.

```sql
insert into usage (workspace_id, resource, count) values (p_workspace_id, p_resource, 1)
on conflict (workspace_id, resource) do update set count = usage.count + 1, updated_at = now();
```

### `decrement_usage(p_workspace_id uuid, p_resource text)`
Decrement but never below 0.

```sql
update usage set count = greatest(count - 1, 0), updated_at = now()
where workspace_id = p_workspace_id and resource = p_resource;
```

---

## Storage buckets

### `avatars`
- **Public read:** yes (URLs embedded in `<img>` server-side)
- **Allowed MIME types:** `image/png`, `image/jpeg`, `image/webp`
- **Max file size:** 2 MB
- **Path convention:** `<user_id>/<timestamp>.<ext>`
- **Upload policy:** authenticated users can upload to a path beginning with their own `auth.uid()`. No deletion via client — old files are best-effort cleaned by the upload handler.

---

## Migration ordering (safe creation order)

1. `00_extensions.sql` — `create extension if not exists pgcrypto;`
2. `01_profiles.sql` — table + trigger + RLS policies + `create_profile_on_signup` trigger on `auth.users`
3. `02_workspaces.sql` — table + RLS
4. `03_workspace_members.sql` — table + RLS (depends on `workspaces`)
5. `04_invitations.sql` — table + RLS (depends on `workspaces`)
6. `05_subscriptions.sql` — table + RLS + `update_updated_at` trigger (depends on `workspaces`)
7. `06_usage.sql` — table + RLS + RPC functions (depends on `workspaces`)
8. `07_projects.sql` — table + RLS (depends on `workspaces`)
9. `08_stripe_events.sql` — table (no FKs, no RLS — service role only)
10. `09_activity_log.sql` — table + RLS (depends on `workspaces` + `auth.users`)
11. `10_bootstrap_workspace.sql` — `bootstrap_workspace` RPC (depends on all above)
12. `11_storage_avatars.sql` — bucket + storage policies

---

## Multi-tenant note

Every domain table has `workspace_id`. RLS uses the `workspace_members` join in every policy. No `user_id` column exists on any domain table outside of `workspace_members.user_id` itself — access is via membership, never via direct ownership.

**Already in place for collaboration unlock:**
- `workspace_members.role` enum supports `owner` / `admin` / `member`
- `activity_log.workspace_id` lets per-workspace audit views work day-1
- Unique `(workspace_id, user_id)` on `workspace_members` prevents duplicate membership

**Will NOT need migration when v2 enables multi-workspace switching:**
- The schema is already correct for N workspaces per user
- The only change is the app layer's assumption that a user has exactly one workspace

---

## Query gotchas

- **`select *` is forbidden** (see `.claude/rules/code.md`). Always select explicit columns. RLS rule changes can silently widen exposure through `select *`.
- **`workspace_members` is the workhorse join.** Every "show me data for the current user's workspace" query has a subquery: `... WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`.
- **Soft delete: not used.** Records are hard-deleted. The `activity_log` retains the action; the row itself is gone. If you need to recover, restore from a Postgres backup, not from a `deleted_at` column.
- **`invitations` UNIQUE is partial.** `UNIQUE (workspace_id, email) WHERE accepted_at IS NULL` — accepted invitations don't block re-invitation. Be careful when querying — "find existing invite" must add `AND accepted_at IS NULL`.
- **`usage.count` increment must use the RPC.** Doing `update usage set count = count + 1` from app code is a race condition under concurrent project creation. Always `supabase.rpc("increment_usage", ...)`.
- **`subscriptions.stripe_subscription_id` can be NULL** for free-plan workspaces. Always check before passing to Stripe SDK calls.
- **`activity_log.actor_id` is nullable on delete.** When a user is deleted, the log row stays but `actor_id` becomes NULL. Render as "Deleted user" in admin UI.
