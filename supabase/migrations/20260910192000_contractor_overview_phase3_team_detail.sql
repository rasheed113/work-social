-- Contractor Overview Phase 3: one owner-authorized, team-scoped operational drill-down.
-- This intentionally exposes only work-intelligence fields. Finance remains separate.

create or replace function public.get_contractor_team_detail(
  p_team_id bigint,
  p_team_number bigint
)
returns table(
  team_id bigint,
  team_number bigint,
  team_name text,
  worker_count bigint,
  taken_pieces numeric,
  taken_amount numeric,
  completed_pieces numeric,
  completed_amount numeric,
  worker_profile_id uuid,
  work_id uuid,
  worker_display_name text,
  worker_username text,
  worker_avatar_url text,
  worker_completed_pieces numeric,
  worker_completed_amount numeric,
  worker_entry_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned_team as (
    select t.id, t.team_number, t.name
    from public.contractor_teams t
    where t.id = p_team_id
      and t.team_number = p_team_number
      and t.leader_profile_id = (select auth.uid())
  ),
  team_taken as (
    select e.team_id,
           coalesce(sum(e.pieces), 0)::numeric as pieces,
           coalesce(sum(e.total), 0)::numeric as amount
    from public.contractor_work_entries e
    join owned_team t on t.id = e.team_id
    where e.profile_id = (select auth.uid())
    group by e.team_id
  ),
  worker_output as (
    select e.team_id,
           e.worker_profile_id,
           coalesce(sum(e.quantity), 0)::numeric as pieces,
           coalesce(sum(e.total), 0)::numeric as amount,
           count(e.id)::bigint as entry_count
    from public.worker_team_work_entries e
    join owned_team t on t.id = e.team_id
    where e.lifecycle_state = 'active'
    group by e.team_id, e.worker_profile_id
  ),
  team_done as (
    select coalesce(sum(w.pieces), 0)::numeric as pieces,
           coalesce(sum(w.amount), 0)::numeric as amount
    from worker_output w
  ),
  team_members as (
    select m.team_id,
           wp.id as worker_profile_id,
           wp.work_id,
           p.display_name,
           p.username,
           p.avatar_url
    from public.contractor_team_members m
    join owned_team t on t.id = m.team_id
    join public.worker_profiles wp on wp.profile_id = m.profile_id
    left join public.profiles p on p.id = wp.profile_id
  )
  select
    t.id,
    t.team_number,
    t.name,
    (select count(*)::bigint from team_members),
    coalesce(tt.pieces, 0),
    coalesce(tt.amount, 0),
    coalesce(td.pieces, 0),
    coalesce(td.amount, 0),
    m.worker_profile_id,
    m.work_id,
    m.display_name,
    m.username,
    m.avatar_url,
    coalesce(wo.pieces, 0),
    coalesce(wo.amount, 0),
    coalesce(wo.entry_count, 0)
  from owned_team t
  left join team_taken tt on tt.team_id = t.id
  cross join team_done td
  left join team_members m on m.team_id = t.id
  left join worker_output wo
    on wo.team_id = m.team_id
   and wo.worker_profile_id = m.worker_profile_id
  order by m.display_name nulls last, m.work_id;
$$;

revoke all on function public.get_contractor_team_detail(bigint,bigint) from public, anon;
grant execute on function public.get_contractor_team_detail(bigint,bigint) to authenticated;
