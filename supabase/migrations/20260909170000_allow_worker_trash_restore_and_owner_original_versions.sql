create or replace function public.restore_worker_team_work_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.worker_team_work_entries e
  set lifecycle_state='active', updated_at=now()
  where e.id=p_entry_id
    and e.lifecycle_state='trashed'
    and exists (
      select 1
      from public.contractor_teams t
      where t.id=e.team_id
        and (
          t.leader_profile_id=(select auth.uid())
          or (
            e.worker_profile_id in (
              select wp.id from public.worker_profiles wp where wp.profile_id=(select auth.uid())
            )
            and exists (
              select 1 from public.contractor_team_members m
              where m.team_id=e.team_id and m.profile_id=(select auth.uid())
            )
          )
        )
    );
  return found;
end;
$$;

create policy "Team owners can view all team work versions"
on public.worker_team_work_entry_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.worker_team_work_entries e
    join public.contractor_teams t on t.id=e.team_id
    where e.id=worker_team_work_entry_versions.work_entry_id
      and t.leader_profile_id=(select auth.uid())
  )
);

grant execute on function public.restore_worker_team_work_entry(uuid) to authenticated;
