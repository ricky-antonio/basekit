-- ============================================================
-- basekit — combined migration (00–10)
-- Paste this entire file into Supabase SQL Editor and run once.
-- Tables are created first, then ALL policies at the end so
-- cross-table references never fail.
-- ============================================================

-- 00 extensions
create extension if not exists pgcrypto;

-- 01 shared trigger function (used by profiles, subscriptions, usage)
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 01 profiles table
create table if not exists profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text        not null default 'user' check (role in ('user', 'admin')),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);

alter table profiles enable row level security;

create or replace function create_profile_on_signup()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_profile_on_signup();

create or replace trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- 02 workspaces table (policies deferred to end — they reference workspace_members)
create table if not exists workspaces (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  owner_id   uuid        not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on workspaces (owner_id);
create unique index if not exists workspaces_slug_idx on workspaces (slug);

alter table workspaces enable row level security;

-- 03 workspace_members table
create table if not exists workspace_members (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         text        not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists members_user_idx      on workspace_members (user_id);
create index if not exists members_workspace_idx on workspace_members (workspace_id);

alter table workspace_members enable row level security;

-- 04 invitations table
create table if not exists invitations (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  email        text        not null,
  role         text        not null default 'member' check (role in ('admin', 'member')),
  token        text        not null unique default gen_random_uuid()::text,
  invited_by   uuid        references auth.users(id),
  accepted_at  timestamptz,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  unique (workspace_id, email) deferrable initially immediate
);

create unique index if not exists invitations_token_idx     on invitations (token);
create        index if not exists invitations_workspace_idx on invitations (workspace_id);
create        index if not exists invitations_email_idx     on invitations (email) where accepted_at is null;

alter table invitations enable row level security;

-- 05 subscriptions table
create table if not exists subscriptions (
  id                     uuid        primary key default gen_random_uuid(),
  workspace_id           uuid        not null unique references workspaces(id) on delete cascade,
  stripe_customer_id     text        unique,
  stripe_subscription_id text        unique,
  stripe_price_id        text,
  plan_name              text        not null default 'free' check (plan_name in ('free', 'pro', 'enterprise')),
  status                 text        not null default 'active' check (
    status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')
  ),
  cancel_at_period_end   boolean     not null default false,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists subscriptions_workspace_idx on subscriptions (workspace_id);
create unique index if not exists subscriptions_customer_idx  on subscriptions (stripe_customer_id);
create        index if not exists subscriptions_status_idx    on subscriptions (status);

alter table subscriptions enable row level security;

create or replace trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

-- 06 usage table
create table if not exists usage (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  resource     text        not null check (resource in ('projects', 'members')),
  count        integer     not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, resource)
);

alter table usage enable row level security;

create or replace trigger usage_updated_at
  before update on usage
  for each row execute function update_updated_at();

create or replace function increment_usage(p_workspace_id uuid, p_resource text)
returns void language sql security definer
set search_path = public as $$
  insert into usage (workspace_id, resource, count)
  values (p_workspace_id, p_resource, 1)
  on conflict (workspace_id, resource)
  do update set count = usage.count + 1, updated_at = now();
$$;

create or replace function decrement_usage(p_workspace_id uuid, p_resource text)
returns void language sql security definer
set search_path = public as $$
  update usage
  set count = greatest(count - 1, 0), updated_at = now()
  where workspace_id = p_workspace_id and resource = p_resource;
$$;

-- 07 projects table
create table if not exists projects (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 64),
  description  text        check (description is null or char_length(description) <= 500),
  created_at   timestamptz not null default now()
);

create index if not exists projects_workspace_idx on projects (workspace_id);

alter table projects enable row level security;

-- 08 stripe_events table (no RLS — service role only)
create table if not exists stripe_events (
  id           text        primary key,
  type         text        not null,
  processed_at timestamptz not null default now()
);

-- 09 activity_log table
create table if not exists activity_log (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        references workspaces(id) on delete cascade,
  actor_id        uuid        references auth.users(id) on delete set null,
  impersonator_id uuid        references auth.users(id) on delete set null,
  action          text        not null,
  target_type     text,
  target_id       text,
  metadata        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists activity_workspace_idx on activity_log (workspace_id, created_at desc);
create index if not exists activity_actor_idx     on activity_log (actor_id, created_at desc);
create index if not exists activity_action_idx    on activity_log (action);

alter table activity_log enable row level security;

-- 10 bootstrap_workspace RPC
create or replace function bootstrap_workspace(
  p_user_id uuid,
  p_name    text,
  p_slug    text
)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_workspace_id uuid;
begin
  insert into workspaces (name, slug, owner_id)
  values (p_name, p_slug, p_user_id)
  returning id into v_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  insert into subscriptions (workspace_id, plan_name, status)
  values (v_workspace_id, 'free', 'active');

  insert into usage (workspace_id, resource, count)
  values
    (v_workspace_id, 'projects', 0),
    (v_workspace_id, 'members',  1);

  return v_workspace_id;
end;
$$;

-- ============================================================
-- RLS HELPER FUNCTIONS (security definer — bypasses RLS for internal lookups)
-- ============================================================

-- Returns all workspace IDs the given user belongs to (avoids recursive RLS on workspace_members)
create or replace function get_user_workspace_ids(p_user_id uuid)
returns setof uuid language sql security definer
set search_path = public as $$
  select workspace_id from workspace_members where user_id = p_user_id;
$$;

-- Returns true if the given user has role = 'admin' in profiles (avoids recursive RLS on profiles)
create or replace function is_admin(p_user_id uuid)
returns boolean language sql security definer
set search_path = public as $$
  select exists (select 1 from profiles where id = p_user_id and role = 'admin');
$$;

-- ============================================================
-- RLS POLICIES — all tables exist by this point
-- ============================================================

-- profiles
create policy profiles_select_own on profiles
  for select using (id = auth.uid());

create policy profiles_update_own on profiles
  for update using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (is_admin(auth.uid()));

-- workspaces
create policy workspaces_select_members on workspaces
  for select using (
    id in (select get_user_workspace_ids(auth.uid()))
  );

create policy workspaces_update_owner on workspaces
  for update using (owner_id = auth.uid());

create policy workspaces_delete_owner on workspaces
  for delete using (owner_id = auth.uid());

create policy workspaces_select_admin on workspaces
  for select using (is_admin(auth.uid()));

-- workspace_members
create policy members_select_same_workspace on workspace_members
  for select using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy members_update_owner_or_admin on workspace_members
  for update using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy members_delete_owner_or_admin on workspace_members
  for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- invitations
create policy invitations_select_workspace on invitations
  for select using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy invitations_insert_owner_or_admin on invitations
  for insert with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy invitations_delete_owner_or_admin on invitations
  for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- subscriptions
create policy subscriptions_select_members on subscriptions
  for select using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy subscriptions_select_admin on subscriptions
  for select using (is_admin(auth.uid()));

-- usage
create policy usage_select_members on usage
  for select using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

-- projects
create policy projects_select_members on projects
  for select using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy projects_insert_members on projects
  for insert with check (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy projects_update_members on projects
  for update using (
    workspace_id in (select get_user_workspace_ids(auth.uid()))
  );

create policy projects_delete_owner_or_admin on projects
  for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = projects.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- activity_log
create policy activity_select_admin on activity_log
  for select using (is_admin(auth.uid()));

-- ============================================================
-- TABLE GRANTS (required when tables are created via SQL Editor, not Supabase UI)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
