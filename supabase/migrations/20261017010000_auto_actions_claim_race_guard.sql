-- Coordinate Auto Action generation and execution claims.
-- Must run AFTER the execution-claim columns migration.
-- Prevents a stale application pre-check from authorizing an
-- insert after another transaction acquires an execution claim.
--
-- This migration does not execute, dismiss, or delete actions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auto_actions'
      AND column_name = 'execution_claim_token'
  ) THEN
    RAISE EXCEPTION
      'Execution claim migration must be applied first';
  END IF;
END;
$$;

-- The execution-claim update and recommendation insert must
-- acquire the same transaction-scoped owner/location lock.
CREATE FUNCTION public.tt_auto_action_lock_execution_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.execution_claim_token IS NULL
     AND NEW.execution_claim_token IS NOT NULL
     AND NEW.status IN ('pending', 'approved')
  THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext(
        'turntable:auto_actions:' || NEW.user_id::text
      ),
      pg_catalog.hashtext(NEW.location_name)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tt_auto_action_lock_execution_claim
BEFORE UPDATE OF execution_claim_token
ON public.auto_actions
FOR EACH ROW
EXECUTE FUNCTION public.tt_auto_action_lock_execution_claim();

-- A fresh recommendation cannot be inserted if the same
-- owner's location already has an unresolved execution claim.
CREATE FUNCTION public.tt_auto_action_guard_claimed_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('pending', 'approved') THEN

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext(
        'turntable:auto_actions:' || NEW.user_id::text
      ),
      pg_catalog.hashtext(NEW.location_name)
    );

    IF EXISTS (
      SELECT 1
      FROM public.auto_actions a
      WHERE a.user_id = NEW.user_id
        AND a.location_name = NEW.location_name
        AND a.status IN ('pending', 'approved')
        AND a.execution_claim_token IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'Auto Action location requires execution reconciliation'
        USING ERRCODE = '23514';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tt_auto_action_guard_claimed_insert
BEFORE INSERT
ON public.auto_actions
FOR EACH ROW
EXECUTE FUNCTION public.tt_auto_action_guard_claimed_insert();
