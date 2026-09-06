-- Development reset for moving RunAI from custom users/password_hash auth
-- to Supabase Auth + public.profiles.
--
-- WARNING: This removes existing RunAI application data in public tables.
-- Use only if your current Supabase project contains test/dev data.
-- After running this file, run database/schema.sql.

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
