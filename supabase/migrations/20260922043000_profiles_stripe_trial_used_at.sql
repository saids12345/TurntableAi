alter table public.profiles
add column if not exists stripe_trial_used_at timestamptz;

update public.profiles
set stripe_trial_used_at = coalesce(updated_at, now())
where stripe_trial_used_at is null
  and stripe_subscription_status is not null
  and stripe_subscription_status not in (
    'incomplete',
    'incomplete_expired'
  );

comment on column public.profiles.stripe_trial_used_at is
  'Timestamp recording that this account has already received its one allowed free trial.';
