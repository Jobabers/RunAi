-- Run after schema.sql and sprint3-transactions.sql.
-- The browser may use Supabase Auth, but all RunAI data mutations must go through the backend.
-- Backend requests use the service_role key, which bypasses RLS.

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.runs enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_progress enable row level security;
alter table public.ai_analysis enable row level security;
alter table public.plan_adjustments enable row level security;

-- Remove the original broad policies. They allowed an authenticated user to update
-- rows that belong to that user, including protected goal and training-plan states.
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists goals_own on public.goals;
drop policy if exists runs_own on public.runs;
drop policy if exists training_plans_own on public.training_plans;
drop policy if exists training_sessions_own on public.training_sessions;
drop policy if exists training_progress_own on public.training_progress;
drop policy if exists ai_analysis_own on public.ai_analysis;
drop policy if exists plan_adjustments_own on public.plan_adjustments;

-- Keeping read-only access to a user's own rows is optional, but no browser role
-- can insert, update, or delete RunAI application data directly.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists goals_select_own on public.goals;
drop policy if exists runs_select_own on public.runs;
drop policy if exists training_plans_select_own on public.training_plans;
drop policy if exists training_sessions_select_own on public.training_sessions;
drop policy if exists training_progress_select_own on public.training_progress;
drop policy if exists ai_analysis_select_own on public.ai_analysis;
drop policy if exists plan_adjustments_select_own on public.plan_adjustments;
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = user_id);

create policy goals_select_own on public.goals
  for select to authenticated using (auth.uid() = user_id);

create policy runs_select_own on public.runs
  for select to authenticated using (auth.uid() = user_id);

create policy training_plans_select_own on public.training_plans
  for select to authenticated using (auth.uid() = user_id);

create policy training_sessions_select_own on public.training_sessions
  for select to authenticated using (
    exists (
      select 1 from public.training_plans
      where training_plans.training_plan_id = training_sessions.training_plan_id
        and training_plans.user_id = auth.uid()
    )
  );

create policy training_progress_select_own on public.training_progress
  for select to authenticated using (
    exists (
      select 1
      from public.training_sessions
      join public.training_plans using (training_plan_id)
      where training_sessions.training_session_id = training_progress.training_session_id
        and training_plans.user_id = auth.uid()
    )
  );

create policy ai_analysis_select_own on public.ai_analysis
  for select to authenticated using (auth.uid() = user_id);

create policy plan_adjustments_select_own on public.plan_adjustments
  for select to authenticated using (
    exists (
      select 1 from public.training_plans
      where training_plans.training_plan_id = plan_adjustments.training_plan_id
        and training_plans.user_id = auth.uid()
    )
  );

revoke insert, update, delete on table
  public.profiles,
  public.goals,
  public.runs,
  public.training_plans,
  public.training_sessions,
  public.training_progress,
  public.ai_analysis,
  public.plan_adjustments
from anon, authenticated;

revoke all on function public.get_runai_dashboard(uuid, integer) from public, anon, authenticated;
revoke all on function public.runai_mutate(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.get_runai_dashboard(uuid, integer) to service_role;
grant execute on function public.runai_mutate(uuid, text, jsonb) to service_role;
