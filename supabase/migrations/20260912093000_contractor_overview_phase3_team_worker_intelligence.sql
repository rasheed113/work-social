-- Contractor Overview Phase 3: business-wide team/worker intelligence.
-- Observational only: no finance/accounting/AI semantics are introduced.

create or replace function public.get_contractor_overview_team_worker_intelligence()
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
team_members as (
  select m.team_id, wp.id as worker_profile_id, wp.profile_id,
         p.display_name, p.username, p.avatar_url
  from public.contractor_team_members m
  join owned_teams t on t.id = m.team_id
  join public.worker_profiles wp on wp.profile_id = m.profile_id
  left join public.profiles p on p.id = m.profile_id
),
team_taken as (
  select e.team_id, coalesce(sum(e.pieces),0)::numeric as taken_pieces
  from public.contractor_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.profile_id = (select auth.uid())
  group by e.team_id
),
team_output as (
  select e.team_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as output_events,
         max(e.occurred_at) as last_activity_at
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
  group by e.team_id
),
team_current as (
  select e.team_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as activity_events
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
    and e.occurred_at >= now() - interval '7 days'
    and e.occurred_at < now()
  group by e.team_id
),
team_previous as (
  select e.team_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as activity_events
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
    and e.occurred_at >= now() - interval '14 days'
    and e.occurred_at < now() - interval '7 days'
  group by e.team_id
),
worker_current as (
  select e.team_id, e.worker_profile_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as activity_events,
         max(e.occurred_at) as last_activity_at
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
    and e.occurred_at >= now() - interval '7 days'
    and e.occurred_at < now()
  group by e.team_id, e.worker_profile_id
),
worker_previous as (
  select e.team_id, e.worker_profile_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as activity_events
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
    and e.occurred_at >= now() - interval '14 days'
    and e.occurred_at < now() - interval '7 days'
  group by e.team_id, e.worker_profile_id
),
worker_lifetime as (
  select e.team_id, e.worker_profile_id,
         coalesce(sum(e.quantity),0)::numeric as completed_pieces,
         count(e.id)::bigint as activity_events
  from public.worker_team_work_entries e
  join owned_teams t on t.id = e.team_id
  where e.lifecycle_state = 'active'
  group by e.team_id, e.worker_profile_id
),
team_rows as (
  select
    t.id as team_id,
    t.team_number,
    t.name as team_name,
    count(tm.worker_profile_id)::bigint as worker_count,
    coalesce(tt.taken_pieces,0)::numeric as taken_pieces,
    coalesce(to1.completed_pieces,0)::numeric as completed_pieces,
    greatest(coalesce(tt.taken_pieces,0) - coalesce(to1.completed_pieces,0),0)::numeric as remaining_pieces,
    case when coalesce(tt.taken_pieces,0) > 0
      then least(100,greatest(0,coalesce(to1.completed_pieces,0) / tt.taken_pieces * 100))
      else null end::numeric as progress_pct,
    coalesce(tc.activity_events,0)::bigint as activity_events_7d,
    coalesce(tc.completed_pieces,0)::numeric as completed_7d,
    coalesce(tp.completed_pieces,0)::numeric as previous_completed_7d,
    case
      when coalesce(tp.completed_pieces,0) > 0 and coalesce(tc.completed_pieces,0) > tp.completed_pieces then 'increasing'
      when coalesce(tp.completed_pieces,0) > 0 and coalesce(tc.completed_pieces,0) < tp.completed_pieces then 'decreasing'
      when coalesce(tp.completed_pieces,0) > 0 then 'stable'
      else 'insufficient'
    end as movement,
    to1.last_activity_at,
    coalesce(to1.output_events,0)::bigint as lifetime_output_events
  from owned_teams t
  left join team_members tm on tm.team_id = t.id
  left join team_taken tt on tt.team_id = t.id
  left join team_output to1 on to1.team_id = t.id
  left join team_current tc on tc.team_id = t.id
  left join team_previous tp on tp.team_id = t.id
  group by t.id,t.team_number,t.name,tt.taken_pieces,to1.completed_pieces,to1.last_activity_at,to1.output_events,tc.activity_events,tc.completed_pieces,tp.completed_pieces
),
team_json as (
  select tr.*,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'worker_profile_id', tm.worker_profile_id,
        'display_name', tm.display_name,
        'username', tm.username,
        'avatar_url', tm.avatar_url,
        'completed_pieces', coalesce(wl.completed_pieces,0),
        'activity_events_7d', coalesce(wc.activity_events,0),
        'completed_7d', coalesce(wc.completed_pieces,0),
        'previous_completed_7d', coalesce(wp.completed_pieces,0),
        'last_activity_at', wc.last_activity_at,
        'movement', case
          when coalesce(wp.completed_pieces,0) > 0 and coalesce(wc.completed_pieces,0) > wp.completed_pieces then 'increasing'
          when coalesce(wp.completed_pieces,0) > 0 and coalesce(wc.completed_pieces,0) < wp.completed_pieces then 'decreasing'
          when coalesce(wp.completed_pieces,0) > 0 then 'stable'
          else 'insufficient'
        end
      ) order by coalesce(wl.completed_pieces,0) desc, coalesce(wc.activity_events,0) desc, tm.profile_id)
      from team_members tm
      left join worker_lifetime wl on wl.team_id = tm.team_id and wl.worker_profile_id = tm.worker_profile_id
      left join worker_current wc on wc.team_id = tm.team_id and wc.worker_profile_id = tm.worker_profile_id
      left join worker_previous wp on wp.team_id = tm.team_id and wp.worker_profile_id = tm.worker_profile_id
      where tm.team_id = tr.team_id
    ), '[]'::jsonb) as workers
  from team_rows tr
)
select jsonb_build_object(
  'generated_at', now(),
  'teams', coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', tj.team_id,
      'team_number', tj.team_number,
      'team_name', tj.team_name,
      'worker_count', tj.worker_count,
      'taken_pieces', tj.taken_pieces,
      'completed_pieces', tj.completed_pieces,
      'remaining_pieces', tj.remaining_pieces,
      'progress_pct', tj.progress_pct,
      'activity_events_7d', tj.activity_events_7d,
      'completed_7d', tj.completed_7d,
      'previous_completed_7d', tj.previous_completed_7d,
      'movement', tj.movement,
      'last_activity_at', tj.last_activity_at,
      'lifetime_output_events', tj.lifetime_output_events,
      'workers', tj.workers
    ) order by tj.completed_pieces desc, tj.taken_pieces desc, tj.activity_events_7d desc, tj.team_number asc)
    from team_json tj
  ), '[]'::jsonb)
);
$$;

revoke all on function public.get_contractor_overview_team_worker_intelligence() from public, anon;
grant execute on function public.get_contractor_overview_team_worker_intelligence() to authenticated;
