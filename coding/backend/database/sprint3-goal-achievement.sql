-- Apply before deploying the Sprint 3 backend. Existing completed goals are preserved.
alter table public.goals add column if not exists achieved_at timestamptz;
alter table public.goals add column if not exists achieved_run_id bigint references public.runs(run_id) on delete set null;
alter table public.goals add column if not exists achievement_choice text
  check (achievement_choice in ('continue', 'complete'));
