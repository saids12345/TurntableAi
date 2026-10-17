-- Enforce ownership of review workflow records.
-- A workflow must reference a review owned by the same user.
-- No existing review or workflow records are modified.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL
     OR to_regclass('public.review_workflow_states') IS NULL
  THEN
    RAISE EXCEPTION
      'Required review tables are missing';
  END IF;
END;
$$;

-- A composite foreign key requires a matching unique key
-- on the referenced columns.
CREATE UNIQUE INDEX
  reviews_id_user_id_workflow_fk_idx
ON public.reviews (id, user_id);

ALTER TABLE public.review_workflow_states
  ADD CONSTRAINT review_workflow_states_review_owner_fk
  FOREIGN KEY (review_id, user_id)
  REFERENCES public.reviews (id, user_id)
  ON DELETE CASCADE
  NOT VALID;

-- Validation fails rather than accepting invalid existing records.
ALTER TABLE public.review_workflow_states
  VALIDATE CONSTRAINT review_workflow_states_review_owner_fk;
