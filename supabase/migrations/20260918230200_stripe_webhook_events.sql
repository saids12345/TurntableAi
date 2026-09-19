-- ============================================================
-- TurnTableAI Stripe Webhook Idempotency
--
-- Records Stripe events only AFTER their business logic has
-- completed successfully.
--
-- If processing fails before completion, no row is written and
-- Stripe can safely retry the webhook.
-- ============================================================

create table if not exists
  public.stripe_webhook_events (
    event_id text primary key,

    event_type text,

    processed_at timestamptz
      not null
      default now()
  );

alter table
  public.stripe_webhook_events
add column if not exists
  event_type text;

alter table
  public.stripe_webhook_events
add column if not exists
  processed_at timestamptz
  default now();

update
  public.stripe_webhook_events
set
  processed_at = now()
where
  processed_at is null;

alter table
  public.stripe_webhook_events
alter column
  processed_at
set default now();

alter table
  public.stripe_webhook_events
alter column
  processed_at
set not null;

create index if not exists
  stripe_webhook_events_processed_at_idx
on public.stripe_webhook_events (
  processed_at desc
);

alter table
  public.stripe_webhook_events
enable row level security;

revoke all
on table
  public.stripe_webhook_events
from
  anon,
  authenticated;

grant
  select,
  insert
on table
  public.stripe_webhook_events
to service_role;
