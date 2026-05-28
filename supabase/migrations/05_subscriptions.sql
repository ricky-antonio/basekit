create table if not exists subscriptions (
  id                       uuid        primary key default gen_random_uuid(),
  workspace_id             uuid        not null unique references workspaces(id) on delete cascade,
  stripe_customer_id       text        unique,
  stripe_subscription_id   text        unique,
  stripe_price_id          text,
  plan_name                text        not null default 'free' check (plan_name in ('free', 'pro', 'enterprise')),
  status                   text        not null default 'active' check (
    status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')
  ),
  cancel_at_period_end     boolean     not null default false,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_end                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists subscriptions_workspace_idx  on subscriptions (workspace_id);
create unique index if not exists subscriptions_customer_idx   on subscriptions (stripe_customer_id);
create        index if not exists subscriptions_status_idx     on subscriptions (status);

alter table subscriptions enable row level security;

create policy subscriptions_select_members on subscriptions
  for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy subscriptions_select_admin on subscriptions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policy — only service role writes subscriptions

create or replace trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();
