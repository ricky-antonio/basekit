create table if not exists activity_log (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        references workspaces(id) on delete cascade,
  actor_id         uuid        references auth.users(id) on delete set null,
  impersonator_id  uuid        references auth.users(id) on delete set null,
  action           text        not null,
  target_type      text,
  target_id        text,
  metadata         jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists activity_workspace_idx on activity_log (workspace_id, created_at desc);
create index if not exists activity_actor_idx     on activity_log (actor_id, created_at desc);
create index if not exists activity_action_idx    on activity_log (action);

alter table activity_log enable row level security;

-- Only admins can read; service role writes
create policy activity_select_admin on activity_log
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
