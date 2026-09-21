alter table public.profiles
add column if not exists stripe_cancel_at timestamptz;

comment on column public.profiles.stripe_cancel_at is
  'Stripe scheduled subscription cancellation timestamp. Null when cancellation is not scheduled.';
