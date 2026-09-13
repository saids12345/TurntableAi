-- TurnTableAI Operator Memory identity hardening.
--
-- Action-scoped memories are uniquely identified by:
--   (user_id, source_action_id)
--
-- Legacy/general memories without a source_action_id retain the
-- semantic identity:
--   (user_id, location_name, problem_type, action_type)
--
-- This migration records the schema rules already established
-- in the production Supabase database.

alter table public.operator_memory
  drop constraint if exists operator_memory_unique_lesson;

drop index if exists public.operator_memory_unique_lesson;
drop index if exists public.operator_memory_unique_active_lesson;

create unique index if not exists operator_memory_unique_source_action
  on public.operator_memory (user_id, source_action_id);

create unique index if not exists operator_memory_unique_lesson
  on public.operator_memory (
    user_id,
    location_name,
    problem_type,
    action_type
  )
  where source_action_id is null;
