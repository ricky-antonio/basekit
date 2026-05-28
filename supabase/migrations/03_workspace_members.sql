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

create policy members_select_same_workspace on workspace_members
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
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
