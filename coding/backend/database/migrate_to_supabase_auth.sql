-- RunAI migration from custom public.users/password_hash auth
-- to Supabase Auth + public.profiles.
--
-- This file first copies existing RunAI public tables into legacy_* backups,
-- then drops the old application tables and enum types.
-- After this file finishes, run database/schema.sql.

do $$
begin
  if to_regclass('public.users') is not null and to_regclass('public.legacy_users_20260906') is null then
    create table public.legacy_users_20260906 as table public.users;
  end if;

  if to_regclass('public.goals') is not null and to_regclass('public.legacy_goals_20260906') is null then
    create table public.legacy_goals_20260906 as table public.goals;
  end if;

  if to_regclass('public.runs') is not null and to_regclass('public.legacy_runs_20260906') is null then
    create table public.legacy_runs_20260906 as table public.runs;
  end if;

  if to_regclass('public.training_plans') is not null and to_regclass('public.legacy_training_plans_20260906') is null then
    create table public.legacy_training_plans_20260906 as table public.training_plans;
  end if;

  if to_regclass('public.training_sessions') is not null and to_regclass('public.legacy_training_sessions_20260906') is null then
    create table public.legacy_training_sessions_20260906 as table public.training_sessions;
  end if;

  if to_regclass('public.training_progress') is not null and to_regclass('public.legacy_training_progress_20260906') is null then
    create table public.legacy_training_progress_20260906 as table public.training_progress;
  end if;

  if to_regclass('public.ai_analysis') is not null and to_regclass('public.legacy_ai_analysis_20260906') is null then
    create table public.legacy_ai_analysis_20260906 as table public.ai_analysis;
  end if;

  if to_regclass('public.plan_adjustments') is not null and to_regclass('public.legacy_plan_adjustments_20260906') is null then
    create table public.legacy_plan_adjustments_20260906 as table public.plan_adjustments;
  end if;
end $$;

drop table if exists plan_adjustments cascade;
drop table if exists ai_analysis cascade;
drop table if exists training_progress cascade;
drop table if exists training_sessions cascade;
drop table if exists training_plans cascade;
drop table if exists runs cascade;
drop table if exists goals cascade;
drop table if exists profiles cascade;
drop table if exists users cascade;

drop type if exists adjustment_status cascade;
drop type if exists ai_trigger_type cascade;
drop type if exists progress_status cascade;
drop type if exists quest_status cascade;
drop type if exists training_plan_status cascade;
drop type if exists run_source cascade;
drop type if exists goal_status cascade;
