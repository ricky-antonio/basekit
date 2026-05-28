create table if not exists usage (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  resource     text        not null check (resource in ('projects', 'members')),
  count        integer     not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, resource)
);

alter table usage enable row level security;

create policy usage_select_members on usage
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- No write policy — only service role / RPC writes

create or replace trigger usage_updated_at
  before update on usage
  for each row execute function update_updated_at();

-- Atomic increment (safe under concurrent requests)
create or replace function increment_usage(p_workspace_id uuid, p_resource text)
returns void language sql security definer
set search_path = public as $$
  insert into usage (workspace_id, resource, count)
  values (p_workspace_id, p_resource, 1)
  on conflict (workspace_id, resource)
  do update set count = usage.count + 1, updated_at = now();
$$;

-- Atomic decrement (never below 0)
create or replace function decrement_usage(p_workspace_id uuid, p_resource text)
returns void language sql security definer
set search_path = public as $$
  update usage
  set count = greatest(count - 1, 0), updated_at = now()
  where workspace_id = p_workspace_id and resource = p_resource;
$$;
