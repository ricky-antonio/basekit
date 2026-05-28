-- Atomically creates workspace + owner membership + free subscription + usage counters.
-- Returns the new workspace id.
create or replace function bootstrap_workspace(
  p_user_id    uuid,
  p_name       text,
  p_slug       text
)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_workspace_id uuid;
begin
  -- Create workspace
  insert into workspaces (name, slug, owner_id)
  values (p_name, p_slug, p_user_id)
  returning id into v_workspace_id;

  -- Add owner as member
  insert into workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, p_user_id, 'owner');

  -- Create free subscription
  insert into subscriptions (workspace_id, plan_name, status)
  values (v_workspace_id, 'free', 'active');

  -- Seed usage counters
  insert into usage (workspace_id, resource, count)
  values
    (v_workspace_id, 'projects', 0),
    (v_workspace_id, 'members',  1);

  return v_workspace_id;
end;
$$;
