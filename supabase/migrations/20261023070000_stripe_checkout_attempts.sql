-- TurnTableAI billing: durable, account-scoped Checkout attempt records.
-- SCHEMA ONLY: checkout concurrency is not protected until the application
-- acquires a claim before creating a Stripe customer or Checkout session.
-- Never automatically release an uncertain attempt: reconcile with Stripe first.

-- Fail rather than silently adopting a table with an unexpected shape.
DO $$
BEGIN
  IF to_regclass('public.stripe_checkout_attempts') IS NOT NULL THEN
    RAISE EXCEPTION 'stripe_checkout_attempts already exists: inspect before applying';
  END IF;
END;
$$;

CREATE TABLE public.stripe_checkout_attempts (
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_id text NOT NULL CHECK (length(price_id) > 0),
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'open', 'needs_review', 'completed', 'expired', 'released')),
  stripe_customer_id text,
  stripe_session_id text UNIQUE,
  checkout_url text,
  session_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_checkout_open_has_session
    CHECK (
      status <> 'open'
      OR (stripe_session_id IS NOT NULL AND checkout_url IS NOT NULL)
    )
);

-- The unique index is the concurrency barrier: exactly one unresolved
-- checkout attempt per Supabase user, even for simultaneous HTTP requests.
-- A new attempt can be created only after a prior attempt is verified
-- terminal and moved out of the claimed/open/needs_review states.
CREATE UNIQUE INDEX stripe_checkout_one_unresolved_per_user
  ON public.stripe_checkout_attempts (user_id)
  WHERE status IN ('claimed', 'open', 'needs_review');

CREATE INDEX stripe_checkout_attempts_user_created_idx
  ON public.stripe_checkout_attempts (user_id, created_at DESC);

-- Checkout URLs and session IDs must not be available to user-facing clients.
ALTER TABLE public.stripe_checkout_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_checkout_attempts
  FROM PUBLIC, anon, authenticated, service_role;

-- Server-side Stripe endpoints use the Supabase service-role client.
-- Deliberately omit DELETE: preserve ambiguous attempts for reconciliation.
GRANT SELECT, INSERT, UPDATE ON TABLE public.stripe_checkout_attempts
  TO service_role;

COMMENT ON TABLE public.stripe_checkout_attempts IS
  'Service-role-only durable Stripe Checkout claims; an uncertain attempt must not be auto-retried or deleted.';
COMMENT ON COLUMN public.stripe_checkout_attempts.attempt_id IS
  'Immutable per-attempt UUID for Stripe idempotency keys and reconciliation.';
COMMENT ON COLUMN public.stripe_checkout_attempts.status IS
  'claimed/open/needs_review block another attempt. completed/expired/released require verification before transition.';
