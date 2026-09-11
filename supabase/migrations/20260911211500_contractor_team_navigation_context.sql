-- Resolve the authoritative internal team id from the existing team number used by
-- the contractor workspace URL. Ownership is enforced in the database.
create or replace function public.get_contractor_team_context_by_number(p_team_number bigint)
returns table(team_id bigint,team_number bigint,team_name text)
language sql
security definer
stable
set search_path=''
as $$
  select t.id,t.team_number,t.name
  from public.contractor_teams t
  where t.team_number=p_team_number
    and t.leader_profile_id=(select auth.uid())
  limit 1;
$$;
revoke all on function public.get_contractor_team_context_by_number(bigint) from public,anon;
grant execute on function public.get_contractor_team_context_by_number(bigint) to authenticated;
