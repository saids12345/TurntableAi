-- TurnTableAI: durable, single-winner Auto Action execution claim.
-- This migration does not execute or modify existing actions.
-- An uncertain execution must not be automatically retried.
--
-- The application must conditionally claim an approved action
-- where execution_claim_token IS NULL before side effects.
-- Claims remain in place until successful finalization
-- or an explicitly reviewed reconciliation.

DO $$
BEGIN
  IF to_regclass('public.auto_actions') IS NULL THEN
    RAISE EXCEPTION
      'auto_actions table missing: establish schema before applying';
  END IF;
END;
$$;

ALTER TABLE public.auto_actions
  ADD COLUMN IF NOT EXISTS execution_claim_token uuid;

ALTER TABLE public.auto_actions
  ADD COLUMN IF NOT EXISTS execution_claimed_at timestamptz;

COMMENT ON COLUMN public.auto_actions.execution_claim_token IS
  'Durable execution claim. Never clear automatically after uncertain execution.';

COMMENT ON COLUMN public.auto_actions.execution_claimed_at IS
  'Time at which execution was claimed; supports manual reconciliation.';
