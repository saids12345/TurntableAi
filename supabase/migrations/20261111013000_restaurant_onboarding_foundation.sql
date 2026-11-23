-- Restaurant onboarding foundation.
-- Apply to the isolated STAGING database first.
-- Existing Google, Square and billing tables are unchanged.

CREATE TABLE public.restaurant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_user_id uuid NOT NULL
    UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),

  expected_location_count integer NOT NULL DEFAULT 1
    CHECK (expected_location_count BETWEEN 1 AND 100),

  primary_goal text NOT NULL DEFAULT 'operations'
    CHECK (primary_goal IN (
      'operations',
      'reputation',
      'revenue',
      'growth',
      'all'
    )),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.restaurant_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  group_id uuid NOT NULL
    REFERENCES public.restaurant_groups(id)
    ON DELETE CASCADE,

  name text NOT NULL
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),

  city text,
  region text,
  country_code text,
  timezone text,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX restaurant_locations_group_idx
  ON public.restaurant_locations(group_id);

CREATE TABLE public.restaurant_onboarding (
  group_id uuid PRIMARY KEY
    REFERENCES public.restaurant_groups(id)
    ON DELETE CASCADE,

  current_step text NOT NULL DEFAULT 'restaurant'
    CHECK (current_step IN (
      'restaurant',
      'locations',
      'integrations',
      'readiness',
      'complete'
    )),

  completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep onboarding isolated between authenticated owners.

ALTER TABLE public.restaurant_groups
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_locations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_onboarding
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.restaurant_groups,
  public.restaurant_locations,
  public.restaurant_onboarding
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.restaurant_groups,
  public.restaurant_locations,
  public.restaurant_onboarding
TO authenticated;

GRANT ALL ON TABLE
  public.restaurant_groups,
  public.restaurant_locations,
  public.restaurant_onboarding
TO service_role;

CREATE POLICY restaurant_groups_owner
ON public.restaurant_groups
FOR ALL TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
);

CREATE POLICY restaurant_locations_owner
ON public.restaurant_locations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurant_groups g
    WHERE g.id = group_id
      AND g.owner_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurant_groups g
    WHERE g.id = group_id
      AND g.owner_user_id = (SELECT auth.uid())
  )
);

CREATE POLICY restaurant_onboarding_owner
ON public.restaurant_onboarding
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurant_groups g
    WHERE g.id = group_id
      AND g.owner_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurant_groups g
    WHERE g.id = group_id
      AND g.owner_user_id = (SELECT auth.uid())
  )
);
