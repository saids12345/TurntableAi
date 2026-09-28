-- TurnTableAI performance signal trust hardening.

-- Remove the known legacy demo performance rows.
delete from public.performance_signal_history
where
  (location_name = 'Mira Mesa' and revenue = 3825 and orders = 188 and avg_ticket = 20.35 and labor_pct = 26 and margin_pct = 58 and refunds = 72)
  or (location_name = 'Chula Vista' and revenue = 4410 and orders = 219 and avg_ticket = 20.14 and labor_pct = 19 and margin_pct = 64 and refunds = 18)
  or (location_name = 'Escondido' and revenue = 3990 and orders = 201 and avg_ticket = 19.85 and labor_pct = 22 and margin_pct = 61 and refunds = 36)
  or (location_name = 'La Jolla' and revenue = 5120 and orders = 246 and avg_ticket = 20.81 and labor_pct = 18 and margin_pct = 67 and refunds = 12);

alter table public.performance_signal_history
  enable row level security;

drop policy if exists "Users can insert their own performance signal history"
  on public.performance_signal_history;

revoke insert, update, delete
  on table public.performance_signal_history
  from anon, authenticated;
