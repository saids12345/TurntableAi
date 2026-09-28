-- TurnTableAI performance signal provenance.

alter table public.performance_signal_history
  add column if not exists source_system text,
  add column if not exists source_record_id text,
  add column if not exists ingested_at timestamptz not null default now();

alter table public.performance_signal_history
  alter column source_system set not null,
  alter column source_record_id set not null;

create unique index if not exists performance_signal_history_source_record_unique
  on public.performance_signal_history (
    user_id,
    source_system,
    source_record_id
  );
