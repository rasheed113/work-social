create or replace function public.get_contractor_team_work_totals(p_team_number bigint,p_day_start timestamptz,p_day_end timestamptz,p_week_start timestamptz,p_week_end timestamptz,p_month_start timestamptz,p_month_end timestamptz)
returns table(daily_total numeric(24,4),weekly_total numeric(24,4),monthly_total numeric(24,4),lifetime_total numeric(24,4),entry_count bigint)
language sql security definer stable set search_path='' as $$
  select coalesce(sum(case when e.occurred_at>=p_day_start and e.occurred_at<p_day_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_week_start and e.occurred_at<p_week_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(case when e.occurred_at>=p_month_start and e.occurred_at<p_month_end then e.total else 0 end),0)::numeric(24,4),coalesce(sum(e.total),0)::numeric(24,4),count(e.id)::bigint
  from public.worker_team_work_entries e join public.contractor_teams t on t.id=e.team_id
  where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and e.lifecycle_state='active';
$$;

create or replace function public.get_contractor_team_work_entries(p_team_number bigint)
returns table(id uuid,item_name text,size text[],quantity numeric,rate numeric,total numeric,special_note text,occurred_at timestamptz,updated_at timestamptz,worker_profile_id uuid,worker_display_name text,worker_username text)
language sql security definer stable set search_path='' as $$
  select e.id,e.item_name,e.size,e.quantity,e.rate,e.total,e.special_note,e.occurred_at,e.updated_at,e.worker_profile_id,p.display_name,p.username
  from public.worker_team_work_entries e join public.contractor_teams t on t.id=e.team_id join public.worker_profiles wp on wp.id=e.worker_profile_id left join public.profiles p on p.id=wp.profile_id
  where t.team_number=p_team_number and t.leader_profile_id=(select auth.uid()) and e.lifecycle_state='active'
  order by e.occurred_at desc,e.id desc limit 100;
$$;

revoke all on function public.get_contractor_team_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz),public.get_contractor_team_work_entries(bigint) from public,anon;
grant execute on function public.get_contractor_team_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz),public.get_contractor_team_work_entries(bigint) to authenticated;
