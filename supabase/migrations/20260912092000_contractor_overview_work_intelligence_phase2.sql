create or replace function public.get_contractor_work_intelligence_phase2(
  p_start timestamptz,
  p_end timestamptz,
  p_previous_start timestamptz,
  p_previous_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with owned_teams as (
    select t.id
    from public.contractor_teams t
    where t.leader_profile_id = (select auth.uid())
  ),
  current_events as (
    select
      date_trunc(
        case when p_end - p_start <= interval '2 days' then 'hour' else 'day' end,
        e.occurred_at
      ) as bucket_at,
      coalesce(sum(e.pieces), 0)::numeric as taken_pieces,
      0::numeric as completed_pieces,
      count(*)::bigint as activity_events
    from public.contractor_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.profile_id = (select auth.uid())
      and e.occurred_at >= p_start
      and e.occurred_at < p_end
    group by 1

    union all

    select
      date_trunc(
        case when p_end - p_start <= interval '2 days' then 'hour' else 'day' end,
        e.occurred_at
      ) as bucket_at,
      0::numeric as taken_pieces,
      coalesce(sum(e.quantity), 0)::numeric as completed_pieces,
      count(*)::bigint as activity_events
    from public.worker_team_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.lifecycle_state = 'active'
      and e.occurred_at >= p_start
      and e.occurred_at < p_end
    group by 1
  ),
  current_series as (
    select
      bucket_at,
      sum(taken_pieces)::numeric as taken_pieces,
      sum(completed_pieces)::numeric as completed_pieces,
      sum(activity_events)::bigint as activity_events
    from current_events
    group by bucket_at
    order by bucket_at
  ),
  current_totals as (
    select
      coalesce(sum(taken_pieces), 0)::numeric as taken_pieces,
      coalesce(sum(completed_pieces), 0)::numeric as completed_pieces,
      coalesce(sum(activity_events), 0)::bigint as activity_events
    from current_events
  ),
  previous_events as (
    select
      coalesce(sum(e.pieces), 0)::numeric as taken_pieces,
      0::numeric as completed_pieces,
      count(*)::bigint as activity_events
    from public.contractor_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.profile_id = (select auth.uid())
      and e.occurred_at >= p_previous_start
      and e.occurred_at < p_previous_end

    union all

    select
      0::numeric as taken_pieces,
      coalesce(sum(e.quantity), 0)::numeric as completed_pieces,
      count(*)::bigint as activity_events
    from public.worker_team_work_entries e
    join owned_teams t on t.id = e.team_id
    where e.lifecycle_state = 'active'
      and e.occurred_at >= p_previous_start
      and e.occurred_at < p_previous_end
  ),
  previous_totals as (
    select
      coalesce(sum(taken_pieces), 0)::numeric as taken_pieces,
      coalesce(sum(completed_pieces), 0)::numeric as completed_pieces,
      coalesce(sum(activity_events), 0)::bigint as activity_events
    from previous_events
  )
  select jsonb_build_object(
    'bucket_unit', case when p_end - p_start <= interval '2 days' then 'hour' else 'day' end,
    'series', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'bucket_at', bucket_at,
          'taken_pieces', taken_pieces,
          'completed_pieces', completed_pieces,
          'activity_events', activity_events
        ) order by bucket_at
      )
      from current_series
    ), '[]'::jsonb),
    'current', (select jsonb_build_object(
      'taken_pieces', taken_pieces,
      'completed_pieces', completed_pieces,
      'activity_events', activity_events
    ) from current_totals),
    'previous', (select jsonb_build_object(
      'taken_pieces', taken_pieces,
      'completed_pieces', completed_pieces,
      'activity_events', activity_events
    ) from previous_totals)
  );
$function$;

revoke all on function public.get_contractor_work_intelligence_phase2(timestamptz, timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.get_contractor_work_intelligence_phase2(timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
