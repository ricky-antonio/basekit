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
  -- one pending invite per email per workspace
  unique (workspace_id, email) deferrable initially immediate
);

-- token lookup (the "secret link")
create unique index if not exists invitations_token_idx     on invitations (token);
create        index if not exists invitations_workspace_idx on invitations (workspace_id);
-- only index pending invites for quick "does this email already have an invite?" checks
create        index if not exists invitations_email_idx     on invitations (email) where accepted_at is null;

alter table invitations enable row level security;

create policy invitations_select_workspace on invitations
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
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
