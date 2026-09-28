-- Archive and remove known demo-derived AI insight outcomes.

create table if not exists public.ai_insight_outcomes_demo_archive_20260927
as
select *
from public.ai_insight_outcomes
where false;

alter table public.ai_insight_outcomes_demo_archive_20260927
  enable row level security;

revoke all
  on table public.ai_insight_outcomes_demo_archive_20260927
  from anon, authenticated;

insert into public.ai_insight_outcomes_demo_archive_20260927
select o.*
from public.ai_insight_outcomes o
where o.id in (
  '782e8c79-516d-44f3-95cf-4bcceb19e381'::uuid,
  'c4d566f0-09dc-4f84-bc50-0013c0e9d5fc'::uuid
)
and not exists (
  select 1
  from public.ai_insight_outcomes_demo_archive_20260927 a
  where a.id = o.id
);

delete from public.ai_insight_outcomes
where id in (
  '782e8c79-516d-44f3-95cf-4bcceb19e381'::uuid,
  'c4d566f0-09dc-4f84-bc50-0013c0e9d5fc'::uuid
);
