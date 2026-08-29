create or replace function private.worker_owns_work_entry(p_work_entry_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.work_entries entry
    join public.worker_profiles wp on wp.id = entry.worker_profile_id
    where entry.id = p_work_entry_id
      and wp.profile_id = (select auth.uid())
  );
$$;

revoke all on function private.worker_owns_work_entry(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.worker_owns_work_entry(uuid) to authenticated;

drop policy if exists "Workers can hide own work entries" on public.work_entry_hidden_for;

create policy "Workers can hide own work entries"
  on public.work_entry_hidden_for
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select private.worker_owns_work_entry(work_entry_id))
  );
