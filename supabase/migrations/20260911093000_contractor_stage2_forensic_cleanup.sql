-- Contractor Stage 2 forensic cleanup.
-- Keep historical team_id IS NULL entries intact, but remove them from the current
-- operational Overview and provide the canonical team-scoped Stage 2 totals RPC.

create or replace function public.get_contractor_stage2_work_totals(
  p_team_id bigint default null,
  p_day_start timestamptz default null,
  p_day_end timestamptz default null,
  p_week_start timestamptz default null,
  p_week_end timestamptz default null,
  p_month_start timestamptz default null,
  p_month_end timestamptz default null
)
returns table(
  daily_total numeric(24,4),
  weekly_total numeric(24,4),
  monthly_total numeric(24,4),
  lifetime_total numeric(24,4),
  commission_total numeric(24,4)
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_team_id is not null and not exists (
    select 1
    from public.contractor_teams t
    where t.id = p_team_id
      and t.leader_profile_id = v_uid
  ) then
    raise exception 'Team not found or not owned by the authenticated contractor';
  end if;

  return query
  select
    coalesce(sum(case when e.occurred_at >= p_day_start and e.occurred_at < p_day_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_week_start and e.occurred_at < p_week_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(case when e.occurred_at >= p_month_start and e.occurred_at < p_month_end then e.total else 0 end), 0)::numeric(24,4),
    coalesce(sum(e.total), 0)::numeric(24,4),
    coalesce(sum(e.pieces * coalesce(e.commission_per_piece, 0)), 0)::numeric(24,4)
  from public.contractor_work_entries e
  where e.profile_id = v_uid
    and (p_team_id is null or e.team_id = p_team_id);
end;
$$;

revoke all on function public.get_contractor_stage2_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_contractor_stage2_work_totals(bigint,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;

create or replace function public.get_contractor_overview_phase4()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with owned_teams as (
    select t.id, t.team_number, t.name
    from public.contractor_teams t
    where t.leader_profile_id = (select auth.uid())
  ),
  team_taken as (
    select e.team_id,
           coalesce(sum(e.pieces), 0)::numeric as taken_pieces,
           coalesce(sum(e.total), 0)::numeric as taken_amount
    from public.contractor_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.profile_id = (select auth.uid())
    group by e.team_id
  ),
  team_done as (
    select e.team_id,
           coalesce(sum(e.quantity), 0)::numeric as completed_pieces,
           coalesce(sum(e.total), 0)::numeric as completed_amount
    from public.worker_team_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.lifecycle_state = 'active'
    group by e.team_id
  ),
  team_workers as (
    select m.team_id, count(*)::bigint as active_workers
    from public.contractor_team_members m
    join owned_teams t on t.id = m.team_id
    group by m.team_id
  ),
  teams as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'team_id', t.id,
        'team_number', t.team_number,
        'team_name', t.name,
        'active_workers', coalesce(w.active_workers, 0),
        'taken_pieces', coalesce(tt.taken_pieces, 0),
        'taken_amount', coalesce(tt.taken_amount, 0),
        'completed_pieces', coalesce(td.completed_pieces, 0),
        'completed_amount', coalesce(td.completed_amount, 0),
        'remaining_pieces', greatest(coalesce(tt.taken_pieces, 0) - coalesce(td.completed_pieces, 0), 0)
      ) order by t.team_number
    ), '[]'::jsonb) as value
    from owned_teams t
    left join team_taken tt on tt.team_id = t.id
    left join team_done td on td.team_id = t.id
    left join team_workers w on w.team_id = t.id
  ),
  overall_taken as (
    select coalesce(sum(e.pieces), 0)::numeric as pieces,
           coalesce(sum(e.total), 0)::numeric as amount
    from public.contractor_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.profile_id = (select auth.uid())
  ),
  overall_done as (
    select coalesce(sum(e.quantity), 0)::numeric as pieces,
           coalesce(sum(e.total), 0)::numeric as amount
    from public.worker_team_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.lifecycle_state = 'active'
  ),
  worker_count as (
    select count(distinct m.profile_id)::bigint as value
    from public.contractor_team_members m
    join owned_teams t on t.id = m.team_id
  ),
  recent_activity as (
    select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.occurred_at desc, a.id desc), '[]'::jsonb) as value
    from (
      select e.id,
             e.item_name,
             e.quantity,
             e.total,
             e.occurred_at,
             t.team_number,
             t.name as team_name,
             e.worker_profile_id,
             p.display_name as worker_display_name,
             p.username as worker_username,
             p.avatar_url as worker_avatar_url
      from public.worker_team_work_entries e
      join owned_teams t on t.id = e.team_id
      join public.worker_profiles wp on wp.id = e.worker_profile_id
      left join public.profiles p on p.id = wp.profile_id
      where e.lifecycle_state = 'active'
      order by e.occurred_at desc, e.id desc
      limit 8
    ) a
  )
  select jsonb_build_object(
    'overall', jsonb_build_object(
      'taken_pieces', (select pieces from overall_taken),
      'taken_amount', (select amount from overall_taken),
      'completed_pieces', (select pieces from overall_done),
      'completed_amount', (select amount from overall_done),
      'active_workers', (select value from worker_count)
    ),
    'teams', (select value from teams),
    'recent_activity', (select value from recent_activity)
  );
$$;

revoke all on function public.get_contractor_overview_phase4() from public, anon;
grant execute on function public.get_contractor_overview_phase4() to authenticated;

drop function if exists public.get_contractor_overview();
