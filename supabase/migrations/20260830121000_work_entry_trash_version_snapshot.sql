-- Keep future immutable revisions independently readable after canonical removal.
create or replace function private.record_work_entry_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.work_entry_versions (
    work_entry_id, worker_profile_id, revision_no, item_name, size, quantity, rate, total,
    special_note, recorded_at, changed_by
  )
  values (
    new.id,
    new.worker_profile_id,
    coalesce((select max(v.revision_no) from public.work_entry_versions v where v.work_entry_id = new.id), 0) + 1,
    new.item_name, new.size, new.quantity, new.rate, new.total,
    new.special_note, now(), (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function private.record_work_entry_version() from public;
grant execute on function private.record_work_entry_version() to authenticated;
