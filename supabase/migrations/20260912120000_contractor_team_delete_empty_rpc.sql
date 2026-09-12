create or replace function public.delete_contractor_team_empty(p_team_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id bigint;
begin
  delete from public.contractor_teams t
  where t.id = p_team_id
    and t.leader_profile_id = auth.uid()
    and not exists (
      select 1
      from public.contractor_team_members m
      where m.team_id = t.id
    )
  returning t.id into deleted_id;

  return deleted_id is not null;
end;
$$;

revoke all on function public.delete_contractor_team_empty(bigint) from public;
grant execute on function public.delete_contractor_team_empty(bigint) to authenticated;
