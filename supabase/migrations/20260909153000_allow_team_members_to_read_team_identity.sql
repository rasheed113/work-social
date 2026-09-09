create or replace function private.worker_team_ids()
returns setof bigint
language sql
security definer
stable
set search_path = ''
as $$
  select m.team_id
  from public.contractor_team_members m
  where m.profile_id = (select auth.uid());
$$;

revoke all on function private.worker_team_ids() from public, anon;
grant execute on function private.worker_team_ids() to authenticated;

drop policy if exists "contractor_teams_select_members" on public.contractor_teams;
create policy "contractor_teams_select_members"
on public.contractor_teams
for select
to authenticated
using (id in (select private.worker_team_ids()));
