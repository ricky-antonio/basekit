-- Idempotency log — service role only, no RLS needed
create table if not exists stripe_events (
  id           text        primary key,  -- Stripe event ID (evt_...)
  type         text        not null,
  processed_at timestamptz not null default now()
);
