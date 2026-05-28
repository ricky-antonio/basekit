create table if not exists projects (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references workspaces(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 64),
  description  text        check (description is null or char_length(description) <= 500),
  created_at   timestamptz not null default now()
);

create index if not exists projects_workspace_idx on projects (workspace_id);

alter table projects enable row level security;

create policy projects_select_members on projects
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy projects_insert_members on projects
  for insert with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy projects_update_members on projects
  for update using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
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
