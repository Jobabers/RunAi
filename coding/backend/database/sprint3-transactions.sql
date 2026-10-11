-- Requires the two earlier Sprint 3 migrations. No existing records are deleted.
-- One transaction and one user-scoped lock cover each command, across API instances.
create or replace function public.runai_mutate(p_user uuid, p_action text, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  g goals%rowtype;
  p training_plans%rowtype;
  s training_sessions%rowtype;
  r runs%rowtype;
  pr training_progress%rowtype;
  a plan_adjustments%rowtype;
  ai ai_analysis%rowtype;
  item jsonb;
  today date := (clock_timestamp() at time zone 'Asia/Bangkok')::date;
  outcome text := p_data->>'outcome';
  distance numeric := (p_data->>'distance')::numeric;
  duration integer := (p_data->>'duration')::integer;
  achievement jsonb := null;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if not exists(select 1 from profiles where user_id=p_user) then raise sqlstate 'PT404' using message='Profile not found'; end if;

  if p_action='goal_choice' then
    select * into g from goals where goal_id=(p_data->>'goal_id')::bigint and user_id=p_user for update;
    if not found then raise sqlstate 'PT404' using message='Goal not found'; end if;
    if g.status <> 'active' or g.achieved_at is null then raise sqlstate 'PT409' using message='Goal is not active and achieved'; end if;
    if outcome not in ('continue','complete') then raise sqlstate 'PT400' using message='Invalid choice'; end if;
    if outcome='complete' then
      update training_plans set status='completed' where goal_id=g.goal_id and user_id=p_user and status='active' returning * into p;
      update plan_adjustments set status='rejected' where status='pending' and training_plan_id in (select training_plan_id from training_plans where goal_id=g.goal_id and user_id=p_user);
      update goals set status='completed',achievement_choice='complete' where goal_id=g.goal_id returning * into g;
    else
      update goals set achievement_choice='continue' where goal_id=g.goal_id returning * into g;
      select * into p from training_plans where goal_id=g.goal_id and user_id=p_user and status='active';
    end if;
    return jsonb_build_object('goal',to_jsonb(g),'active_plan',case when p.training_plan_id is null then null else to_jsonb(p) end);
  end if;

  if p_action in ('quest','refresh','save_adjustment','adjustment_decision') then
    if p_action='quest' then
      select * into s from training_sessions where training_session_id=(p_data->>'session_id')::bigint;
      select * into p from training_plans where training_plan_id=s.training_plan_id and user_id=p_user for update;
    elsif p_action='adjustment_decision' then
      select * into a from plan_adjustments where plan_adjustment_id=(p_data->>'adjustment_id')::bigint;
      select * into p from training_plans where training_plan_id=a.training_plan_id and user_id=p_user for update;
    else
      select * into p from training_plans where training_plan_id=(p_data->>'plan_id')::bigint and user_id=p_user for update;
    end if;
    if not found then raise sqlstate 'PT404' using message='Plan not found'; end if;
    if p.status <> 'active' then raise sqlstate 'PT409' using message='Plan is closed'; end if;
  end if;

  if p_action='refresh' then
    insert into training_progress(training_session_id,status,submitted_at)
      select ts.training_session_id,'expired',((ts.session_date+1)::timestamp at time zone 'Asia/Bangkok')
      from training_sessions ts where ts.training_plan_id=p.training_plan_id and ts.session_date<today
      on conflict(training_session_id) do nothing;
    update training_sessions ts set status=case
      when exists(select 1 from training_progress tp where tp.training_session_id=ts.training_session_id) then
        (select tp.status::text::quest_status from training_progress tp where tp.training_session_id=ts.training_session_id)
      when ts.session_date>today then 'locked'::quest_status else 'available'::quest_status end
      where ts.training_plan_id=p.training_plan_id;
    return coalesce((select jsonb_agg(to_jsonb(ts) order by session_date) from training_sessions ts where training_plan_id=p.training_plan_id),'[]'::jsonb);
  end if;

  if p_action='adjustment_decision' then
    if a.status<>'pending' then raise sqlstate 'PT409' using message='Adjustment already decided'; end if;
    if outcome not in ('accepted','rejected') then raise sqlstate 'PT400' using message='Invalid decision'; end if;
    if outcome='accepted' then
      select * into ai from ai_analysis where ai_analysis_id=a.ai_analysis_id;
      if ai.result_json ? 'from_version' and (ai.result_json->>'from_version')::integer<>p.version then raise sqlstate 'PT409' using message='Plan version changed'; end if;
      delete from training_sessions ts where training_plan_id=p.training_plan_id and session_date>today
        and not exists(select 1 from training_progress tp where tp.training_session_id=ts.training_session_id);
      for item in select value from jsonb_array_elements(a.proposed_sessions) loop
        if (item->>'session_date')::date>today then
          insert into training_sessions(training_plan_id,session_date,training_type,target_distance,target_duration_minutes,status,note)
          values(p.training_plan_id,(item->>'session_date')::date,item->>'training_type',(item->>'target_distance')::numeric,(item->>'target_duration_minutes')::integer,'locked',item->>'note');
        end if;
      end loop;
      update training_plans set version=version+1 where training_plan_id=p.training_plan_id returning * into p;
    end if;
    update plan_adjustments set status=outcome::adjustment_status,accepted_at=case when outcome='accepted' then now() else null end where plan_adjustment_id=a.plan_adjustment_id returning * into a;
    return jsonb_build_object('plan',to_jsonb(p),'adjustment',to_jsonb(a));
  end if;

  if p_action='save_adjustment' then
    select * into a from plan_adjustments where training_plan_id=p.training_plan_id and status='pending';
    if found then return to_jsonb(a); end if;
    select pa.* into a from plan_adjustments pa join ai_analysis x using(ai_analysis_id)
      where pa.training_plan_id=p.training_plan_id and x.result_json->>'failed_session_id'=p_data->'analysis'->>'failed_session_id' limit 1;
    if found then return to_jsonb(a); end if;
    if (p_data->'analysis'->>'from_version')::integer<>p.version then raise sqlstate 'PT409' using message='Plan changed while analyzing'; end if;
    insert into ai_analysis(user_id,training_plan_id,trigger_type,result_json) values(p_user,p.training_plan_id,(p_data->>'trigger_type')::ai_trigger_type,p_data->'analysis') returning * into ai;
    insert into plan_adjustments(training_plan_id,ai_analysis_id,reason,status,proposed_sessions) values(p.training_plan_id,ai.ai_analysis_id,p_data->>'reason','pending',p_data->'sessions') returning * into a;
    return to_jsonb(a);
  end if;

  if p_action in ('quest','run') then
    if p_action='quest' then
      if s.session_date<>today or exists(select 1 from training_progress where training_session_id=s.training_session_id) then raise sqlstate 'PT409' using message='Quest is not available'; end if;
      if outcome not in ('completed','failed') then raise sqlstate 'PT400' using message='Invalid quest outcome'; end if;
      if outcome='completed' and (distance is null or duration is null or distance<s.target_distance) then raise sqlstate 'PT422' using message='Quest distance not reached'; end if;
      if outcome='failed' and (nullif(btrim(p_data->>'reason'),'') is null or distance>=s.target_distance) then raise sqlstate 'PT422' using message='Invalid failed quest'; end if;
    end if;
    if distance is not null or duration is not null or p_action='run' then
      if distance is null or duration is null or distance<=0 or distance>300 or duration<=0 or duration>1440 then raise sqlstate 'PT400' using message='Invalid running result'; end if;
      insert into runs(user_id,run_date,distance,duration_minutes,run_type,source)
      values(p_user,case when p_action='quest' then today else (p_data->>'run_date')::date end,distance,duration,
        case when p_action='quest' then s.training_type else p_data->>'run_type' end,case when p_action='quest' then 'quest'::run_source else 'manual'::run_source end) returning * into r;
      update goals set achieved_at=now(),achieved_run_id=r.run_id,achievement_choice=null
        where user_id=p_user and status='active' and achieved_at is null and target_distance<=r.distance
        and (target_duration_minutes is null or target_duration_minutes>=r.duration_minutes) returning * into g;
      if found then achievement:=jsonb_build_object('goal',to_jsonb(g),'achieved',true); end if;
    end if;
    if p_action='run' then return jsonb_build_object('run',to_jsonb(r),'goal_completion',achievement); end if;
    insert into training_progress(training_session_id,run_id,status,actual_distance,actual_duration_minutes,failure_reason,submitted_at,strava_image_url)
      values(s.training_session_id,r.run_id,outcome::progress_status,distance,duration,p_data->>'reason',now(),p_data->>'image_url') returning * into pr;
    update training_sessions set status=outcome::quest_status where training_session_id=s.training_session_id returning * into s;
    return jsonb_build_object('session',to_jsonb(s),'run',case when r.run_id is null then null else to_jsonb(r) end,'progress',to_jsonb(pr),'goal_completion',achievement);
  end if;
  raise sqlstate 'PT400' using message='Unknown mutation';
end;
$$;
revoke all on function public.runai_mutate(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.runai_mutate(uuid,text,jsonb) to service_role;

alter function public.get_runai_dashboard(uuid,integer) set timezone = 'Asia/Bangkok';
revoke all on function public.get_runai_dashboard(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_runai_dashboard(uuid,integer) to service_role;
