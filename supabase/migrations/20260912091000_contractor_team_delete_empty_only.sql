grant delete on table public.contractor_teams to authenticated;

drop policy if exists contractor_teams_delete_empty on public.contractor_teams;
create policy contractor_teams_delete_empty
  on public.contractor_teams
  for delete
  to authenticated
  using (
    (select auth.uid()) = leader_profile_id
    and not exists (
      select 1
      from public.contractor_team_members m
      where m.team_id = contractor_teams.id
    )
  );
