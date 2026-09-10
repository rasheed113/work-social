alter table public.contractor_work_entries add column if not exists team_id bigint references public.contractor_teams(id) on delete set null;
alter table public.contractor_work_entry_trash add column if not exists team_id bigint references public.contractor_teams(id) on delete set null;
create index if not exists contractor_work_entries_team_id_idx on public.contractor_work_entries(team_id);
create index if not exists contractor_work_entry_trash_team_id_idx on public.contractor_work_entry_trash(team_id);

drop function if exists public.get_contractor_overview();
create function public.get_contractor_overview()
returns table(
  team_id bigint,
  team_number bigint,
  team_name text,
  active_workers bigint,
  taken_pieces numeric,
  taken_amount numeric,
  completed_pieces numeric,
  completed_amount numeric,
  overall_taken_pieces numeric,
  overall_taken_amount numeric,
  overall_completed_pieces numeric,
  overall_completed_amount numeric
)
language sql
stable
security definer
set search_path=''
as $$
  with owned_teams as (
    select t.id, t.team_number, t.name
    from public.contractor_teams t
    where t.leader_profile_id=(select auth.uid())
  ),
  team_taken as (
    select e.team_id,
           coalesce(sum(e.pieces),0)::numeric as pieces,
           coalesce(sum(e.total),0)::numeric as amount
    from public.contractor_work_entries e
    join owned_teams t on t.id=e.team_id
    where e.profile_id=(select auth.uid())
    group by e.team_id
  ),
  team_done as (
    select e.team_id,
           coalesce(sum(e.quantity),0)::numeric as pieces,
           coalesce(sum(e.total),0)::numeric as amount
    from public.worker_team_work_entries e
    join owned_teams t on t.id=e.team_id
    where e.lifecycle_state='active'
    group by e.team_id
  ),
  team_workers as (
    select m.team_id,count(*)::bigint as worker_count
    from public.contractor_team_members m
    join owned_teams t on t.id=m.team_id
    group by m.team_id
  ),
  overall_taken as (
    select coalesce(sum(e.pieces),0)::numeric as pieces,
           coalesce(sum(e.total),0)::numeric as amount
    from public.contractor_work_entries e
    where e.profile_id=(select auth.uid())
  ),
  overall_done as (
    select coalesce(sum(e.quantity),0)::numeric as pieces,
           coalesce(sum(e.total),0)::numeric as amount
    from public.worker_team_work_entries e
    join owned_teams t on t.id=e.team_id
    where e.lifecycle_state='active'
  )
  select
    t.id,
    t.team_number,
    t.name,
    coalesce(w.worker_count,0),
    coalesce(tt.pieces,0),
    coalesce(tt.amount,0),
    coalesce(td.pieces,0),
    coalesce(td.amount,0),
    (select pieces from overall_taken),
    (select amount from overall_taken),
    (select pieces from overall_done),
    (select amount from overall_done)
  from owned_teams t
  left join team_taken tt on tt.team_id=t.id
  left join team_done td on td.team_id=t.id
  left join team_workers w on w.team_id=t.id
  order by t.team_number;
$$;
revoke all on function public.get_contractor_overview() from public,anon;
grant execute on function public.get_contractor_overview() to authenticated;
