-- ============================================================
-- TurnTableAI Brain Persistent Belief State
--
-- Purpose:
-- Persist the Brain's latest cognitive belief system between
-- separate Brain runs.
--
-- This table is NOT Operator Memory.
--
-- operator_memory:
--   verified real-world action/outcome learning
--
-- brain_belief_state:
--   latest cognitive belief snapshot used for belief revision
-- ============================================================

create table if not exists public.brain_belief_state (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- Stable identity for the reasoning scope.
  --
  -- Examples:
  --   network
  --   location:Mira Mesa
  scope_key text not null,

  mode text not null
    check (
      mode in (
        'single_location',
        'network'
      )
    ),

  location_name text,

  -- Serialized BeliefSystem from
  -- src/lib/brain/reasoning/beliefSystem.ts
  belief_system jsonb not null,

  -- BrainContext.metadata.runId that produced
  -- the currently persisted snapshot.
  source_run_id text not null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint brain_belief_state_scope_key_not_blank
    check (
      length(
        btrim(scope_key)
      ) > 0
    ),

  constraint brain_belief_state_location_scope_valid
    check (
      (
        mode = 'network'
        and location_name is null
      )
      or
      (
        mode = 'single_location'
        and location_name is not null
        and length(
          btrim(location_name)
        ) > 0
      )
    ),

  constraint brain_belief_state_unique_scope
    unique (
      user_id,
      scope_key
    )
);

create index if not exists
  brain_belief_state_user_updated_idx
on public.brain_belief_state (
  user_id,
  updated_at desc
);

alter table
  public.brain_belief_state
enable row level security;

drop policy if exists
  "brain_belief_state_owner_access"
on public.brain_belief_state;

create policy
  "brain_belief_state_owner_access"
on public.brain_belief_state
for all
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

grant
  select,
  insert,
  update,
  delete
on table
  public.brain_belief_state
to authenticated;
