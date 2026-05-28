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

create policy workspaces_select_members on workspaces
  for select using (
    id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy workspaces_update_owner on workspaces
  for update using (owner_id = auth.uid());

create policy workspaces_delete_owner on workspaces
  for delete using (owner_id = auth.uid());

create policy workspaces_select_admin on workspaces
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
