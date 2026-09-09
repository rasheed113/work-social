grant select on public.contractor_team_member_exit_requests to authenticated;
create policy contractor_team_member_exit_requests_owner_select
on public.contractor_team_member_exit_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.contractor_teams t
    where t.id = contractor_team_member_exit_requests.team_id
      and t.leader_profile_id = (select auth.uid())
  )
);
