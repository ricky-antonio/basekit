create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  role         text        not null default 'user' check (role in ('user', 'admin')),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles (role);

alter table profiles enable row level security;

create policy profiles_select_own on profiles
  for select using (id = auth.uid());

create policy profiles_update_own on profiles
  for update using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Trigger: auto-create profile when a user signs up
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

-- Trigger: keep updated_at current
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
